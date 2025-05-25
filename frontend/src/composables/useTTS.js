import { ref, onUnmounted, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTTSStore } from '../stores/ttsStore'
import { API_ENDPOINTS } from '../constants/api'
import { useAudioContext } from './useAudioContext'
import { useAudioChunks } from './useAudioChunks'
import { usePlayback } from './usePlayback'
import { downloadAudio as downloadAudioHelper } from './useDownload'
import { concatenateAudioBuffers } from '../utils/audioHelpers'
import { useAPI } from './useAPI'

export function useTTS() {
  const ttsStore = useTTSStore()
  const {
    isGenerating,
    progressMessage,
    unifiedBuffer,
    audioDuration,
    isDownloadComplete,
    downloadProgress,
    volume: storeVolume,
  } = storeToRefs(ttsStore)
  const {
    updateUnifiedBuffer,
    setIsPlaying,
    setCurrentSource,
    setPlaybackProgress,
    setCurrentTime,
    setIsDownloadComplete,
    setDownloadProgress,
    setVolumeAndApply,
  } = ttsStore
  const audioQueue = [] // For streaming chunks

  // Audio context
  const { audioContext, gainNode, initAudio, setVolume: applyVolumeToAudioContext, closeAudio } = useAudioContext()

  // Playback control - get the simplified API
  const playbackAPI = usePlayback(audioContext, gainNode)
  const {
    isPlaying,
    currentSource,
    currentTime,
    playbackProgress,
    updatePlaybackProgress,
    startProgressUpdates,
    stopProgressUpdates,
    setTotalDuration,
    seekToPosition,
    seekRelative,
    togglePlayback,
    switchToHtmlAudio,
    isUsingHtmlAudio,
    htmlAudio,
    startTime,
    pausedTime
  } = playbackAPI

  // Streaming progress tracking for Web Audio phase
  let streamingElapsedTime = 0

  console.log('currentSource in useTTS setup:', currentSource);

  // Simplified watch for generation completion - immediately switch to HTML5 Audio
  watch([isDownloadComplete, unifiedBuffer], async ([downloadComplete, buffer]) => {
    if (downloadComplete && buffer && !isUsingHtmlAudio.value) {
      console.log('🔄 Generation complete, switching to HTML5 Audio for replay capability')
      
      // Calculate current streaming time for seamless transition
      const wasStreamingAndPlaying = isPlaying.value;
      let streamPlaybackTime = 0;
      
      if (currentSource.value && audioContext.value) {
        // Calculate how much time has elapsed in the current streaming session
        streamPlaybackTime = audioContext.value.currentTime - startTime.value;
        streamPlaybackTime = Math.max(0, streamPlaybackTime);
      } else {
        streamPlaybackTime = currentTime.value; // Fallback to store's currentTime
      }
      
      // Call the new simplified switchToHtmlAudio
      await switchToHtmlAudio(
        buffer,                    // The complete AudioBuffer
        wasStreamingAndPlaying,    // preserveCurrentPlayTime: whether to preserve timing
        streamPlaybackTime         // seekToTimeAfterSwitch: time to seek to after switch
      )
      
      console.log('✅ HTML5 Audio switch completed')
    }
  })

  // Audio chunks management
  const { chunkCache, currentChunkIndex, fetchAudioChunk, fetchNextChunks, resetChunks } = useAudioChunks(audioContext)

  let currentAbortController = null
  let currentSessionId = null

  // Single speaker generation
  async function generateSpeech(text, voice) {
    console.log('currentSource at start of generateSpeech:', currentSource);
    
    if (!text.trim()) {
      progressMessage.value = 'Please enter some text'
      return
    }

    try {
      currentAbortController = new AbortController()
      
      initAudio()
      console.log('audioContext after initAudio():', audioContext);
      console.log('audioContext.value after initAudio():', audioContext ? audioContext.value : 'audioContext is null');
      if (!audioContext || !audioContext.value) {
        console.error('AudioContext is not initialized. audioContext or audioContext.value is null/undefined after initAudio().');
        progressMessage.value = 'Error: Audio context could not be initialized.';
        isGenerating.value = false;
        return; 
      }
      if (audioContext.value && audioContext.value.state === 'suspended') {
        await audioContext.value.resume()
      }

      isGenerating.value = true
      progressMessage.value = 'Initializing...'

      // Reset state variables (including chunk state)
      resetChunks()
      setIsDownloadComplete(false)
      setDownloadProgress(0)
      audioQueue.length = 0
      updateUnifiedBuffer(null, setTotalDuration)
      // Reset streaming progress tracking
      streamingElapsedTime = 0
      
      // Clean up any existing Web Audio source
      if (currentSource.value) {
        currentSource.value.onended = null
        try {
          currentSource.value.stop()
        } catch (e) {
          console.warn('Could not stop audio source in error handler (may not have been started):', e.message);
        }
        currentSource.value.disconnect()
        setCurrentSource(null)
      }

      // Get first chunk and start playback via useAudioChunks
      const firstChunk = await fetchAudioChunk(text, voice, 0, isGenerating)
      if (!firstChunk) {
        throw new Error('Failed to fetch initial audio chunk')
      }

      const totalChunks = firstChunk.totalChunks
      audioQueue.push(firstChunk.buffer)
      currentChunkIndex.value++

      // Store session ID when received in first chunk
      const sessionId = firstChunk.headers?.get('X-Session-ID')
      if (sessionId) {
        currentSessionId = sessionId
      }

      if (totalChunks === 1) {
        updateUnifiedBuffer(firstChunk.buffer, setTotalDuration)
        setIsDownloadComplete(true)
        console.log('🎵 Single chunk generation complete, duration:', firstChunk.buffer.duration)
      } else {
        fetchNextChunks(text, voice, isGenerating, unifiedBuffer, audioQueue, isDownloadComplete)
        console.log('🎵 Multi-chunk generation started, first chunk duration:', firstChunk.buffer.duration)
      }

      await playNextChunk(text, voice)
    } catch (error) {
      console.error('Error during speech generation:', error)
      console.log('currentSource IN CATCH BLOCK:', currentSource);
      console.log('typeof currentSource IN CATCH BLOCK:', typeof currentSource);
      progressMessage.value = `Error: ${error.message}`
      isGenerating.value = false
      setIsPlaying(false)
      if (currentSource.value) {
        currentSource.value.onended = null
        try {
          currentSource.value.stop()
        } catch (e) {
          console.warn('Could not stop audio source in catch block (may not have been started):', e.message);
        }
        currentSource.value.disconnect()
        setCurrentSource(null)
      }
    } finally {
      currentAbortController = null
    }
  }

  // Simplified playNextChunk for Web Audio streaming (pre-HTML5 switch only)
  async function playNextChunk(text, voice) {
    if (audioQueue.length > 0) {
      const buffer = audioQueue.shift()
      
      if (currentSource.value) {
        currentSource.value.onended = null
        currentSource.value.stop()
        currentSource.value.disconnect()
      }

      const newSource = audioContext.value.createBufferSource()
      newSource.buffer = buffer
      newSource.connect(gainNode.value)
      newSource.sessionId = currentSessionId
      setCurrentSource(newSource) // Update store

      if (!isPlaying.value) {
        setIsPlaying(true)
        // Let usePlayback manage its startTime
        pausedTime.value = 0; // Reset for new stream
        startTime.value = audioContext.value.currentTime;
        startProgressUpdates()
      }

      newSource.start(0)
      newSource.onended = () => {
        // Update usePlayback's tracking for cumulative time
        streamingElapsedTime += buffer.duration
        startTime.value = audioContext.value.currentTime - streamingElapsedTime;
        
        if (audioQueue.length > 0) {
          console.log('▶️ Playing next queued chunk, remaining:', audioQueue.length)
          playNextChunk(text, voice)
        } else if (isGenerating.value) {
          setTimeout(() => playNextChunk(text, voice), 200)
        } else {
          console.log('✅ Streaming playback complete')
          setIsPlaying(false)
          progressMessage.value = 'Playback complete!'
        }
      }

      if (!isDownloadComplete.value) {
        fetchNextChunks(text, voice, isGenerating, unifiedBuffer, audioQueue, isDownloadComplete)
      }
    } else if (isGenerating.value) {
      setTimeout(() => playNextChunk(text, voice), 200)
    }
  }

  // Multi-speaker generation (assumes a full WAV is returned)
  async function generateMultiSpeech(text, speakers) {
    if (!text.trim()) {
      progressMessage.value = 'Please enter some text'
      return
    }

    try {
      initAudio()
      if (!audioContext || !audioContext.value) {
        console.error('AudioContext is not initialized in generateMultiSpeech. audioContext or audioContext.value is null/undefined after initAudio().');
        progressMessage.value = 'Error: Audio context could not be initialized for multi-speech.';
        isGenerating.value = false;
        return; 
      }
      if (audioContext.value && audioContext.value.state === 'suspended') {
        await audioContext.value.resume()
      }

      isGenerating.value = true
      progressMessage.value = 'Initializing multi-speaker generation...'

      currentChunkIndex.value = 0
      setIsDownloadComplete(false)
      setDownloadProgress(0)
      audioQueue.length = 0
      chunkCache.clear()
      updateUnifiedBuffer(null, setTotalDuration)

      if (currentSource.value) {
        currentSource.value.onended = null
        currentSource.value.stop()
        currentSource.value.disconnect()
        setCurrentSource(null)
      }

      const api = useAPI()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 50000)

      const multiResponse = await api.generateMultiSpeech({
        text,
        speakers,
        speed: 1.0,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const sessionId = multiResponse.sessionId
      const arrayBuffer = multiResponse.arrayBuffer
      const decodedBuffer = await audioContext.value.decodeAudioData(arrayBuffer)
      
      updateUnifiedBuffer(decodedBuffer, setTotalDuration)
      setIsDownloadComplete(true)

      // For multi-speaker, immediately switch to HTML5 since we have the complete buffer
      await switchToHtmlAudio(decodedBuffer, 0, true)

      isGenerating.value = false
    } catch (error) {
      console.error('Error during multi-speaker speech generation:', error)
      progressMessage.value = `Error: ${error.message}`
      isGenerating.value = false
      setIsPlaying(false)
      if (currentSource.value) {
        currentSource.value.onended = null
        currentSource.value.stop()
        currentSource.value.disconnect()
        setCurrentSource(null)
      }
    }
  }

  function setSyncedVolume(newVolumeValue) {
    // newVolumeValue is already normalized (0-1) from usePlayback
    // Apply it to both Web Audio context and HTML5 audio always
    applyVolumeToAudioContext(newVolumeValue);
    
    // Also update HTML5 audio volume if it exists (whether playing or not)
    if (htmlAudio.value) {
      htmlAudio.value.volume = newVolumeValue;
      console.log('📢 Updated HTML5 audio volume to:', newVolumeValue);
    }
  }

  // Simplified toggle playback handler
  async function togglePlaybackHandler() {
    console.log('🎮 Toggle playback called')
    // Just delegate to usePlayback - it will handle HTML5 vs Web Audio internally
    await togglePlayback()
  }

  async function stopGeneration() {
    if (currentAbortController) {
      console.log('Aborting pending fetch...')
      currentAbortController.abort()
      currentAbortController = null
    }
    
    const sessionToStop = currentSessionId || currentSource.value?.sessionId || ""
    try {
      const api = useAPI()
      await api.stopGeneration(sessionToStop)
      console.log('Stop generation request sent for session:', sessionToStop)
    } catch (error) {
      console.error('Error stopping generation:', error)
    } finally {
      currentSessionId = null
    }
  }

  async function reset() {
    if (currentSessionId || currentAbortController) {
      await stopGeneration()
    }
    isGenerating.value = false

    if (currentSource.value) {
      currentSource.value.onended = null
      currentSource.value.stop()
      currentSource.value.disconnect()
      setCurrentSource(null)
    }
    
    // Stop HTML5 audio if it exists
    if (htmlAudio.value) {
      htmlAudio.value.pause()
      htmlAudio.value.src = ''
      htmlAudio.value = null
    }
    isUsingHtmlAudio.value = false
    
    if (audioContext.value) {
      closeAudio()
    }
    
    setSyncedVolume(0.8)
    progressMessage.value = ''
    setIsPlaying(false)
    // Reset our chunk state
    resetChunks()
    audioQueue.length = 0
    currentChunkIndex.value = 0
    updateUnifiedBuffer(null, setTotalDuration)
    setDownloadProgress(0)
    setPlaybackProgress(0)
    setIsDownloadComplete(false)
    setCurrentTime(0)
    stopProgressUpdates()
    
    // Reset streaming time tracking
    streamingElapsedTime = 0
  }

  async function downloadAudio() {
    await downloadAudioHelper(unifiedBuffer, isDownloadComplete, progressMessage)
  }

  // Simplified seek handlers - only work after download complete (when HTML5 is active)
  async function seekToPositionHandler(pos) {
    console.log(`🎯 Seek to position ${pos}% called`)
    
    if (!isDownloadComplete.value) {
      console.warn('Seek ignored: Download not complete yet')
      return
    }
    
    // usePlayback will handle the HTML5 seeking internally
    seekToPosition(pos)
  }

  async function seekRelativeHandler(offset) {
    console.log(`⏩ Seek relative ${offset}s called`)
    
    if (!isDownloadComplete.value) {
      console.warn('Seek relative ignored: Download not complete yet')
      return
    }
    
    // usePlayback will handle the HTML5 seeking internally
    seekRelative(offset)
  }

  const handleChunkProgress = (event) => {
    progressMessage.value = event.detail.message
  }

  onMounted(() => {
    window.addEventListener('chunk-progress', handleChunkProgress)
  })

  onUnmounted(() => {
    stopProgressUpdates()
    reset()
    window.removeEventListener('chunk-progress', handleChunkProgress)
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
    generateMultiSpeech,
    togglePlayback: togglePlaybackHandler,
    reset,
    setTotalDuration,
    setVolume: setSyncedVolume,
    volume: storeVolume,
    seekToPosition: seekToPositionHandler,
    seekRelative: seekRelativeHandler,
    downloadAudio,
    audioDuration,
    currentTime,
    stopGeneration,
    unifiedBuffer
  }
}