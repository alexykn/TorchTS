import { ref, onUnmounted } from 'vue'
import { API_ENDPOINTS } from '../constants/api'

export function useTTS() {
  const audioContext = ref(null)
  const gainNode = ref(null)
  const isPlaying = ref(false)
  const isGenerating = ref(false)
  const progressMessage = ref('')
  const currentSource = ref(null)
  const audioQueue = []
  const chunkCache = new Map()
  const downloadProgress = ref(0)  // 0 to 100
  const currentChunkIndex = ref(0)
  const playbackProgress = ref(0)  // 0 to 100
  const isDownloadComplete = ref(false)
  let totalChunks = 0
  let validatedTotalChunks = null
  let isFetching = false
  let startTime = 0
  let pausedTime = 0
  let totalDuration = 0
  let unifiedBuffer = null

  function initAudio() {
    if (!audioContext.value) {
      audioContext.value = new (window.AudioContext || window.webkitAudioContext)()
      gainNode.value = audioContext.value.createGain()
      gainNode.value.connect(audioContext.value.destination)
    }
  }

  function setVolume(volume) {
    if (gainNode.value) {
      gainNode.value.gain.value = volume
    }
  }

  function concatenateAudioBuffers(audioBuffers) {
    const totalLength = audioBuffers.reduce((acc, buffer) => acc + buffer.length, 0)
    const result = audioContext.value.createBuffer(
      1, // mono
      totalLength,
      audioBuffers[0].sampleRate
    )
    const channelData = result.getChannelData(0)
    
    let offset = 0
    for (const buffer of audioBuffers) {
      channelData.set(buffer.getChannelData(0), offset)
      offset += buffer.length
    }
    
    return result
  }

  async function createUnifiedBuffer() {
    const sortedBuffers = Array.from({ length: validatedTotalChunks }, (_, i) => chunkCache.get(i))
    if (sortedBuffers.some(buffer => !buffer)) {
      throw new Error('Missing audio chunks')
    }
    unifiedBuffer = concatenateAudioBuffers(sortedBuffers)
    totalDuration = unifiedBuffer.duration
    return unifiedBuffer
  }

  async function fetchAudioChunk(text, voice, chunkId, retryCount = 0) {
    try {
      progressMessage.value = `Fetching chunk ${chunkId + 1}/${totalChunks}...`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

      const response = await fetch(API_ENDPOINTS.GENERATE_SPEECH, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          voice, 
          chunk_id: chunkId,
          speed: 1.0
        })
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }
      
      const currentChunk = parseInt(response.headers.get('X-Current-Chunk'))
      const newTotalChunks = parseInt(response.headers.get('X-Total-Chunks'))
      
      if (currentChunk === undefined || newTotalChunks === undefined) {
        throw new Error('Invalid chunk information from server')
      }

      if (validatedTotalChunks === null) {
        validatedTotalChunks = newTotalChunks
        totalChunks = newTotalChunks
      } else if (newTotalChunks !== validatedTotalChunks) {
        throw new Error('Inconsistent total chunks received from server')
      }

      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await audioContext.value.decodeAudioData(arrayBuffer)
      
      // Update download progress
      if (!chunkCache.has(currentChunk)) {
        chunkCache.set(currentChunk, audioBuffer)
        downloadProgress.value = Math.round((chunkCache.size / totalChunks) * 100)
      }
      
      return {
        buffer: audioBuffer,
        currentChunk,
        totalChunks: validatedTotalChunks
      }
    } catch (error) {
      if (retryCount < 3) {
        console.warn(`Retrying chunk ${chunkId} (attempt ${retryCount + 1}): ${error.message}`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return fetchAudioChunk(text, voice, chunkId, retryCount + 1)
      }
      throw new Error(`Failed to fetch chunk ${chunkId} after 3 attempts: ${error.message}`)
    }
  }

  function updatePlaybackProgress() {
    if (!isPlaying.value || !audioContext.value) return
    
    const currentTime = audioContext.value.currentTime - startTime
    playbackProgress.value = Math.min(100, Math.round((currentTime / totalDuration) * 100))
    
    if (isPlaying.value) {
      requestAnimationFrame(updatePlaybackProgress)
    }
  }

  async function seekToPosition(position) {
    if (!isDownloadComplete.value || !unifiedBuffer) return
    
    const targetTime = (position / 100) * totalDuration
    
    if (currentSource.value) {
      currentSource.value.onended = null
      currentSource.value.stop()
      currentSource.value.disconnect()
    }

    currentSource.value = audioContext.value.createBufferSource()
    currentSource.value.buffer = unifiedBuffer
    currentSource.value.connect(gainNode.value)
    
    if (!isPlaying.value) {
      isGenerating.value = false
      isPlaying.value = true
    }
    
    startTime = audioContext.value.currentTime - targetTime
    currentSource.value.start(0, targetTime)
    requestAnimationFrame(updatePlaybackProgress)
    
    currentSource.value.onended = () => {
      if (isPlaying.value) {
        isPlaying.value = false
        progressMessage.value = 'Playback complete!'
      }
    }
  }

  async function fetchNextChunks(text, voice) {
    if (isFetching || currentChunkIndex.value >= totalChunks) return
    
    isFetching = true
    try {
      while (currentChunkIndex.value < totalChunks) {
        const nextChunkId = currentChunkIndex.value
        if (!chunkCache.has(nextChunkId)) {
          const chunk = await fetchAudioChunk(text, voice, nextChunkId)
          if (audioQueue.length === 0 && !unifiedBuffer) {
            audioQueue.push(chunk.buffer)
          }
        }
        currentChunkIndex.value++
      }
      
      // Create unified buffer once all chunks are downloaded
      await createUnifiedBuffer()
      isDownloadComplete.value = true
      
      // If we're currently playing, switch to the unified buffer
      if (isPlaying.value) {
        const currentTime = audioContext.value.currentTime - startTime
        seekToPosition((currentTime / totalDuration) * 100)
      }
    } catch (error) {
      console.error('Error fetching chunks:', error)
      progressMessage.value = `Error: ${error.message}`
    } finally {
      isFetching = false
    }
  }

  async function playNextChunk(text, voice) {
    // If we have a unified buffer, use that instead of chunks
    if (unifiedBuffer) {
      if (!currentSource.value || !isPlaying.value) {
        currentSource.value = audioContext.value.createBufferSource()
        currentSource.value.buffer = unifiedBuffer
        currentSource.value.connect(gainNode.value)
        
        if (!isPlaying.value) {
          isGenerating.value = false
          isPlaying.value = true
          startTime = audioContext.value.currentTime
        }
        
        currentSource.value.start(0)
        requestAnimationFrame(updatePlaybackProgress)
        
        currentSource.value.onended = () => {
          if (isPlaying.value) {
            isPlaying.value = false
            progressMessage.value = 'Playback complete!'
          }
        }
      }
      return
    }

    // Original chunk-based playback logic for initial playback
    if (audioQueue.length === 0) {
      const nextChunkBuffer = chunkCache.get(currentChunkIndex.value)
      if (nextChunkBuffer) {
        audioQueue.push(nextChunkBuffer)
        currentChunkIndex.value++
      } else if (currentChunkIndex.value < validatedTotalChunks && !isFetching) {
        await fetchNextChunks(text, voice)
        return
      } else if (currentChunkIndex.value >= validatedTotalChunks && !currentSource.value) {
        isGenerating.value = false
        isPlaying.value = false
        progressMessage.value = 'Playback complete!'
        return
      }
    }

    if (audioQueue.length > 0) {
      const buffer = audioQueue.shift()
      if (currentSource.value) {
        currentSource.value.onended = null
        currentSource.value.stop()
        currentSource.value.disconnect()
      }

      currentSource.value = audioContext.value.createBufferSource()
      currentSource.value.buffer = buffer
      currentSource.value.connect(gainNode.value)

      if (!isPlaying.value) {
        isGenerating.value = false
        isPlaying.value = true
        startTime = audioContext.value.currentTime - pausedTime
        requestAnimationFrame(updatePlaybackProgress)
      }

      currentSource.value.start(0)
      currentSource.value.onended = () => {
        if (isPlaying.value) {
          playNextChunk(text, voice)
        }
      }
    }
  }

  async function generateSpeech(text, voice) {
    if (!text.trim()) {
      progressMessage.value = 'Please enter some text'
      return
    }

    try {
      initAudio()
      if (audioContext.value.state === 'suspended') {
        await audioContext.value.resume()
      }

      isGenerating.value = true
      progressMessage.value = 'Initializing...'
      
      // Reset all state variables
      currentChunkIndex.value = 0
      totalChunks = 0
      downloadProgress.value = 0
      audioQueue.length = 0
      chunkCache.clear()
      
      if (currentSource.value) {
        currentSource.value.onended = null
        currentSource.value.stop()
        currentSource.value.disconnect()
        currentSource.value = null
      }

      // Get first chunk and start playback
      const firstChunk = await fetchAudioChunk(text, voice, 0)
      if (!firstChunk) {
        throw new Error('Failed to fetch initial audio chunk')
      }

      totalChunks = firstChunk.totalChunks
      audioQueue.push(firstChunk.buffer)
      currentChunkIndex.value++
      
      // If there's only one chunk, mark as complete immediately
      if (totalChunks === 1) {
        await createUnifiedBuffer()
        isDownloadComplete.value = true
      }
      
      // Start playback of first chunk
      await playNextChunk(text, voice)
      
      // Start fetching remaining chunks if any
      if (totalChunks > 1) {
        fetchNextChunks(text, voice)
      }
      
      isPlaying.value = true
    } catch (error) {
      console.error('Error during speech generation:', error)
      progressMessage.value = `Error: ${error.message}`
      isGenerating.value = false
      isPlaying.value = false
      
      if (currentSource.value) {
        currentSource.value.onended = null
        currentSource.value.stop()
        currentSource.value.disconnect()
        currentSource.value = null
      }
    }
  }

  function togglePlayback() {
    if (!currentSource.value) return
    
    if (isPlaying.value) {
      audioContext.value.suspend()
      pausedTime = audioContext.value.currentTime - startTime
    } else {
      audioContext.value.resume()
      startTime = audioContext.value.currentTime - pausedTime
      requestAnimationFrame(updatePlaybackProgress)
    }
    isPlaying.value = !isPlaying.value
  }

  function reset() {
    if (currentSource.value) {
      currentSource.value.stop()
      currentSource.value.disconnect()
      currentSource.value = null
    }
    if (audioContext.value) {
      audioContext.value.close()
      audioContext.value = null
    }
    gainNode.value = null
    progressMessage.value = ''
    isPlaying.value = false
    audioQueue.length = 0
    currentChunkIndex.value = 0
    validatedTotalChunks = null
    totalChunks = 0
    downloadProgress.value = 0
    playbackProgress.value = 0
    isDownloadComplete.value = false
    totalDuration = 0
    startTime = 0
    pausedTime = 0
    unifiedBuffer = null
    chunkCache.clear()
  }

  async function downloadAudio() {
    if (!unifiedBuffer || !isDownloadComplete.value) return

    try {
      // Create an offline audio context for encoding
      const offlineCtx = new OfflineAudioContext(1, unifiedBuffer.length, unifiedBuffer.sampleRate)
      
      // Create source from unified buffer
      const source = offlineCtx.createBufferSource()
      source.buffer = unifiedBuffer
      source.connect(offlineCtx.destination)
      source.start()

      // Render audio
      const renderedBuffer = await offlineCtx.startRendering()

      // Convert to WAV format
      const wavBlob = await audioBufferToWav(renderedBuffer)
      
      // Create download link
      const url = URL.createObjectURL(wavBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'audio.wav' // WAV has better quality than MP3 for this use case
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading audio:', error)
      progressMessage.value = `Error downloading: ${error.message}`
    }
  }

  // Helper function to convert AudioBuffer to WAV
  function audioBufferToWav(buffer) {
    const numChannels = 1
    const sampleRate = buffer.sampleRate
    const format = 1 // PCM
    const bitDepth = 16
    const bytesPerSample = bitDepth / 8
    const blockAlign = numChannels * bytesPerSample
    
    const wavDataBytes = buffer.length * blockAlign
    const headerBytes = 44
    const totalBytes = headerBytes + wavDataBytes
    
    const arrayBuffer = new ArrayBuffer(totalBytes)
    const dataView = new DataView(arrayBuffer)
    
    // RIFF identifier
    writeString(dataView, 0, 'RIFF')
    // RIFF chunk length
    dataView.setUint32(4, 36 + wavDataBytes, true)
    // RIFF type
    writeString(dataView, 8, 'WAVE')
    // Format chunk identifier
    writeString(dataView, 12, 'fmt ')
    // Format chunk length
    dataView.setUint32(16, 16, true)
    // Sample format (raw)
    dataView.setUint16(20, format, true)
    // Channel count
    dataView.setUint16(22, numChannels, true)
    // Sample rate
    dataView.setUint32(24, sampleRate, true)
    // Byte rate (sample rate * block align)
    dataView.setUint32(28, sampleRate * blockAlign, true)
    // Block align (channel count * bytes per sample)
    dataView.setUint16(32, blockAlign, true)
    // Bits per sample
    dataView.setUint16(34, bitDepth, true)
    // Data chunk identifier
    writeString(dataView, 36, 'data')
    // Data chunk length
    dataView.setUint32(40, wavDataBytes, true)
    
    // Write audio data
    const channelData = buffer.getChannelData(0)
    let offset = 44
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]))
      dataView.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' })
  }

  function writeString(dataView, offset, string) {
    for (let i = 0; i < string.length; i++) {
      dataView.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  onUnmounted(() => {
    reset()
  })

  return {
    isPlaying,
    isGenerating,
    progressMessage,
    currentSource,
    downloadProgress,
    currentChunkIndex,
    playbackProgress,
    isDownloadComplete,
    generateSpeech,
    togglePlayback,
    reset,
    setVolume,
    seekToPosition,
    downloadAudio
  }
} 