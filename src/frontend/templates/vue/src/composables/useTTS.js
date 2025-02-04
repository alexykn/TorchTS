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
  const audioDuration = ref(0)
  const currentTime = ref(0)  // Add current time ref
  let totalChunks = 0
  let validatedTotalChunks = null
  let isFetching = false
  let startTime = 0
  let pausedTime = 0
  let totalDuration = 0
  let unifiedBuffer = null
  let progressInterval = null  // Add interval reference
  let currentSessionId = null  // Add session ID tracking, mutable so we can update it
  let currentAbortController = null
  // NEW: hold the latest seek time independent of currentTime when paused
  let currentSeek = 0

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
    const audioBuffers = Array.from(chunkCache.values())
    unifiedBuffer = concatenateAudioBuffers(audioBuffers)
    totalDuration = unifiedBuffer.duration
    audioDuration.value = totalDuration
    return unifiedBuffer
  }

  async function fetchAudioChunk(text, voice, chunkId, retryCount = 0) {
    try {
      progressMessage.value = `Fetching chunk ${chunkId + 1}/${totalChunks}...`
      currentAbortController = new AbortController()
      const timeoutId = setTimeout(() => currentAbortController.abort(), 50000) // 50s timeout

      const response = await fetch(API_ENDPOINTS.GENERATE_SPEECH, {
        method: 'POST',
        signal: currentAbortController.signal,
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
      const sessionId = response.headers.get('X-Session-ID')
      
      if (sessionId) {
        currentSessionId = sessionId
      }

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
      // If the request was aborted or generation was cancelled, don't retry
      if (error.name === 'AbortError' || error.message.includes('cancelled')) {
        console.warn(`Fetch for chunk ${chunkId} aborted/cancelled`)
        throw error  // Re-throw to stop the chunk fetching process
      }
      
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
    
    const elapsed = audioContext.value.currentTime - startTime
    currentTime.value = Math.min(totalDuration, elapsed)
    playbackProgress.value = Math.min(100, (elapsed / totalDuration) * 100)
    
    // Always request next frame if playing
    if (isPlaying.value) {
      requestAnimationFrame(updatePlaybackProgress)
    }
  }

  function startProgressUpdates() {
    if (!isPlaying.value) return
    
    // Start the update cycle directly
    requestAnimationFrame(updatePlaybackProgress)
  }

  function stopProgressUpdates() {
    // Just update the final position when stopping
    if (audioContext.value) {
      const elapsed = audioContext.value.currentTime - startTime
      currentTime.value = Math.min(totalDuration, elapsed)
      playbackProgress.value = Math.min(100, (elapsed / totalDuration) * 100)
    }
  }

  function seekToPosition(position) {
    // Add a small helper to ensure position is within bounds
    const boundedPosition = Math.max(0, Math.min(100, position))
    
    if (unifiedBuffer && isDownloadComplete.value) {
      const newTime = (boundedPosition / 100) * totalDuration
      
      if (currentSource.value) {
        currentSource.value.onended = null
        currentSource.value.stop()
        currentSource.value.disconnect()
      }
      
      currentSource.value = audioContext.value.createBufferSource()
      currentSource.value.buffer = unifiedBuffer
      currentSource.value.connect(gainNode.value)
      
      // Save the current seek position
      currentSeek = newTime
      
      // Update time tracking regardless of play state
      startTime = audioContext.value.currentTime - newTime
      currentTime.value = newTime
      playbackProgress.value = boundedPosition
      
      if (isPlaying.value) {
        currentSource.value.start(0, newTime)
        startProgressUpdates()
      }
      
      currentSource.value.onended = () => {
        isPlaying.value = false
        progressMessage.value = 'Playback complete!'
        stopProgressUpdates()
      }
    }
  }

  // Update seekRelative to handle paused state with proper 5-second steps
  function seekRelative(offsetSeconds) {
    if (unifiedBuffer && isDownloadComplete.value) {
      // Now use currentSeek instead of currentTime.value so that we accumulate 5-second steps correctly
      const newTime = Math.max(0, Math.min(totalDuration, currentSeek + offsetSeconds))
      const newPosition = (newTime / totalDuration) * 100
      seekToPosition(newPosition)
    }
  }

  async function fetchNextChunks(text, voice) {
    if (isFetching || currentChunkIndex.value >= totalChunks || !isGenerating.value) return
    
    isFetching = true
    try {
      // Fetch chunks sequentially but aggressively
      while (currentChunkIndex.value < totalChunks && isGenerating.value) {
        const nextChunkId = currentChunkIndex.value
        
        // If we don't have this chunk yet, fetch it
        if (!chunkCache.has(nextChunkId)) {
          const chunk = await fetchAudioChunk(text, voice, nextChunkId)
          if (!unifiedBuffer && chunk) {
            audioQueue.push(chunk.buffer)
          }
        } else if (!unifiedBuffer) {
          // If chunk is in cache but not queued, queue it
          audioQueue.push(chunkCache.get(nextChunkId))
        }
        
        currentChunkIndex.value++
      }
      
      // Create unified buffer once all chunks are downloaded
      if (isGenerating.value && currentChunkIndex.value >= totalChunks && chunkCache.size === totalChunks) {
        await createUnifiedBuffer()
        isDownloadComplete.value = true
        
        // If we're currently playing, switch to the unified buffer
        if (isPlaying.value) {
          const currentTime = audioContext.value.currentTime - startTime
          seekToPosition((currentTime / totalDuration) * 100)
        }
      }
    } catch (error) {
      // Don't show errors for intentional cancellation
      if (error.name === 'AbortError' || error.message.includes('cancelled')) {
        console.log('Generation stopped by user')
        isGenerating.value = false
        progressMessage.value = ''
      } else {
        console.error('Error fetching chunks:', error)
        progressMessage.value = `Error: ${error.message}`
      }
    } finally {
      isFetching = false
    }
  }

  async function playNextChunk(text, voice) {
    // If we have a unified buffer, use that instead of chunks
    if (unifiedBuffer) {
      if (!currentSource.value || !isPlaying.value) {
        currentSource.value = audioContext.value.createBufferSource();
        currentSource.value.buffer = unifiedBuffer;
        currentSource.value.connect(gainNode.value);

        if (!isPlaying.value) {
          isPlaying.value = true;
          startTime = audioContext.value.currentTime;
        }

        currentSource.value.start(0);
        startProgressUpdates();

        currentSource.value.onended = () => {
          if (isPlaying.value) {
            isPlaying.value = false;
            progressMessage.value = 'Playback complete!';
            stopProgressUpdates();
          }
        };
      }
      return;
    }

    // If there are no chunks available yet, wait a bit (poll) if generation is still in progress
    if (audioQueue.length === 0) {
      if (isGenerating.value) {
        setTimeout(() => playNextChunk(text, voice), 200);
      }
      return;
    }

    // There is at least one chunk in the audioQueue: play it.
    const buffer = audioQueue.shift();
    if (currentSource.value) {
      currentSource.value.onended = null;
      currentSource.value.stop();
      currentSource.value.disconnect();
    }

    currentSource.value = audioContext.value.createBufferSource();
    currentSource.value.buffer = buffer;
    currentSource.value.connect(gainNode.value);

    if (!isPlaying.value) {
      isPlaying.value = true;
      startTime = audioContext.value.currentTime - pausedTime;
      startProgressUpdates();
    }

    currentSource.value.start(0);
    currentSource.value.onended = () => {
      if (isPlaying.value) {
        playNextChunk(text, voice);
      }
    };

    // Always try to fetch more chunks if the download is not complete
    if (!isDownloadComplete.value) {
      fetchNextChunks(text, voice);
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

      // Ensure currentSessionId is set, using the same logic as backend
      if (!currentSessionId) {
        currentSessionId = `${voice}_${text.slice(0, 32)}`
        console.log('Computed session ID:', currentSessionId)
      }
      
      // If there's only one chunk, mark as complete immediately
      if (totalChunks === 1) {
        await createUnifiedBuffer()
        isDownloadComplete.value = true
      } else {
        // Start fetching remaining chunks immediately
        fetchNextChunks(text, voice)
      }
      
      // Start playback of first chunk
      await playNextChunk(text, voice)
      
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

  async function togglePlayback() {
    if (!currentSource.value) return
    
    if (isPlaying.value) {
      // Pause playback
      isPlaying.value = false  // Set state before suspending
      await audioContext.value.suspend()
      pausedTime = audioContext.value.currentTime - startTime
      stopProgressUpdates()
    } else {
      // Resume playback
      await audioContext.value.resume()
      // Update the start time to maintain correct position after resume
      startTime = audioContext.value.currentTime - pausedTime
      isPlaying.value = true  // Set state before starting updates
      if (isDownloadComplete.value) {
        requestAnimationFrame(updatePlaybackProgress)  // Start the update cycle
      }
    }
  }

  async function stopGeneration() {
    if (currentAbortController) {
      console.log('Aborting pending fetch...')
      currentAbortController.abort()
      currentAbortController = null
    }
    // Always send a stop-generation request, even if no active session
    const sessionToStop = currentSessionId || ""
    try {
      const response = await fetch(API_ENDPOINTS.STOP_GENERATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionToStop })
      })
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error stopping generation:', errorData.error)
      } else {
        console.log('Stop generation request sent for session:', sessionToStop)
      }
    } catch (error) {
      console.error('Error stopping generation:', error)
    } finally {
      currentSessionId = null
    }
  }

  async function reset() {
    // First stop any ongoing generation
    if (currentSessionId || currentAbortController) {
      await stopGeneration()
    }
    isGenerating.value = false  // Ensure generating state is cleared
    
    if (currentSource.value) {
      currentSource.value.onended = null  // Remove event listener
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
    currentTime.value = 0
    stopProgressUpdates()
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

  // New function to generate multi-speaker speech
  async function generateMultiSpeech(text, speakers) {
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
      progressMessage.value = 'Initializing multi-speaker generation...'
      
      // Reset state variables similar to generateSpeech
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
      currentSessionId = null

      // Send the multi-speaker POST request
      currentAbortController = new AbortController()
      const timeoutId = setTimeout(() => currentAbortController.abort(), 50000) // 50s timeout

      const response = await fetch(API_ENDPOINTS.GENERATE_SPEECH_MULTI, {
        method: 'POST',
        signal: currentAbortController.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          speed: 1.0,
          speakers  // e.g. { "1": "am_michael", "2": "bf_emma", "3": "bm_george", "4": "af_nicole" }
        })
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }
      
      const sessionId = response.headers.get('X-Session-ID')
      if (sessionId) {
        currentSessionId = sessionId
      }
      
      // In multi mode we assume the endpoint streams the complete WAV audio
      const arrayBuffer = await response.arrayBuffer()
      unifiedBuffer = await audioContext.value.decodeAudioData(arrayBuffer)
      
      totalDuration = unifiedBuffer.duration
      audioDuration.value = totalDuration
      isDownloadComplete.value = true
      
      // Create an AudioBufferSourceNode for playback
      currentSource.value = audioContext.value.createBufferSource()
      currentSource.value.buffer = unifiedBuffer
      currentSource.value.connect(gainNode.value)
      isPlaying.value = true
      startTime = audioContext.value.currentTime
      currentSource.value.start(0)
      startProgressUpdates()
      
      currentSource.value.onended = () => {
        isPlaying.value = false
        progressMessage.value = 'Playback complete!'
        stopProgressUpdates()
      }
      
      isGenerating.value = false
    } catch (error) {
      console.error('Error during multi-speaker speech generation:', error)
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

  onUnmounted(() => {
    stopProgressUpdates()  // Clean up interval on unmount
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
    generateMultiSpeech,  // New export for multi mode
    togglePlayback,
    reset,
    setVolume,
    seekToPosition,
    downloadAudio,
    audioDuration,
    currentTime,
    stopGeneration,  // Export stopGeneration function
    seekRelative,    // Add this to exports
  }
} 