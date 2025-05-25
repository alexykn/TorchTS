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
    volume: storeVolume, // Add this
  } = storeToRefs(ttsStore)
  const {
    updateUnifiedBuffer,
    setIsPlaying,
    setCurrentSource,
    setPlaybackProgress,
    setCurrentTime,
    setIsDownloadComplete,
    setDownloadProgress,
    setVolumeAndApply, // Add this
  } = ttsStore
  const audioQueue = [] // For streaming chunks

  // Audio context
  const { audioContext, gainNode, initAudio, setVolume: applyVolumeToAudioContext, closeAudio } = useAudioContext()

  // Playback control
  const {
    isPlaying,
    currentSource,
    startTime,
    pausedTime,
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
    htmlAudio
  } = usePlayback(audioContext, gainNode)

  // Streaming mode progress tracking
  let streamingStartTime = 0
  let streamingElapsedTime = 0

  console.log('currentSource in useTTS setup:', currentSource);

  // Watch for generation completion to switch to HTML5 Audio
  watch([isDownloadComplete, unifiedBuffer], ([downloadComplete, buffer]) => {
    if (downloadComplete && buffer && !isUsingHtmlAudio.value) {
      console.log('🔄 Generation complete, switching to HTML5 Audio for replay capability')
      
      // More aggressive switch - stop current Web Audio immediately
      if (currentSource.value) {
        console.log('⏹️ Stopping Web Audio source for auto-switch')
        currentSource.value.onended = null
        try {
          currentSource.value.stop()
          currentSource.value.disconnect()
        } catch (error) {
          console.log('Error stopping source during auto-switch:', error.message)
        }
        setCurrentSource(null)
      }
      
      // Exit streaming mode
      streamingMode = false
      
      // Switch to HTML5 Audio with current position preserved
      switchToHtmlAudio(buffer, true)
    }
  })

  // Audio chunks management
  const { chunkCache, currentChunkIndex, fetchAudioChunk, fetchNextChunks, resetChunks } = useAudioChunks(audioContext)

  let currentAbortController = null
  let currentSessionId = null

  // NEW: Flag to determine if we're in "streaming mode"
  // (while true, we use the audioQueue; once the user intervenes, we switch to unifiedBuffer for playback)
  let streamingMode = true
  let switchingToHtml = false // Prevent multiple rapid switches

  // Helper function to check if we should immediately switch to HTML5 Audio
  function shouldSwitchToHtmlAudio() {
    return isDownloadComplete.value && 
           unifiedBuffer.value && 
           !isUsingHtmlAudio.value && 
           !switchingToHtml
  }

  // Helper function to perform the switch to HTML5 Audio
  async function performHtmlAudioSwitch() {
    if (!shouldSwitchToHtmlAudio()) return false
    
    console.log('🔄 Switching to HTML5 Audio - stopping context playback')
    switchingToHtml = true
    
    // Stop current context playback immediately
    if (currentSource.value) {
      console.log('⏹️ Stopping current Web Audio source')
      currentSource.value.onended = null
      try {
        currentSource.value.stop()
        currentSource.value.disconnect()
      } catch (error) {
        console.log('Error stopping current source:', error.message)
      }
      setCurrentSource(null)
    }
    
    // Suspend audio context to fully stop Web Audio
    if (audioContext.value && audioContext.value.state !== 'suspended') {
      console.log('⏸️ Suspending audio context')
      try {
        await audioContext.value.suspend()
      } catch (error) {
        console.log('Error suspending audio context:', error.message)
      }
    }
    
    setIsPlaying(false)
    
    // Switch to HTML5 Audio and preserve current playback position
    console.log('🎵 Creating HTML5 Audio element')
    switchToHtmlAudio(unifiedBuffer.value, true)
    
    // Reset the switching flag after a brief delay
    setTimeout(() => { switchingToHtml = false }, 100)
    
    return true
  }

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
      // make sure we start in streaming mode for new generations:
      streamingMode = true
      // Reset streaming progress tracking
      streamingStartTime = 0
      streamingElapsedTime = 0
      
      // Reset to Web Audio mode for new generation
      if (isUsingHtmlAudio.value) {
        isUsingHtmlAudio.value = false
        if (htmlAudio.value) {
          htmlAudio.value.pause()
          htmlAudio.value.src = ''
          htmlAudio.value = null
        }
      }

      console.log('About to check currentSource.value. currentSource is:', currentSource);
      console.log('typeof currentSource:', typeof currentSource);
      
      if (currentSource.value) {
        currentSource.value.onended = null
        currentSource.value.stop()
        currentSource.value.disconnect()
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
        if (currentSource.value) {
          currentSource.value.sessionId = sessionId
        }
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
        currentSource.value.stop()
        currentSource.value.disconnect()
      }
    } finally {
      currentAbortController = null
    }
  }

  // -----------------------------------------------------------------------------
  // Modified Playback for streaming chunks:
  // Instead of automatically switching to the unifiedBuffer once it exists,
  // we only use it if streamingMode === false. While streamingMode is true the queued
  // chunks will be played one after another.
  async function playNextChunk(text, voice) {
    if (streamingMode) {
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
        currentSource.value.sessionId = currentSessionId

        if (!isPlaying.value) {
          setIsPlaying(true)
          // For streaming mode, track cumulative time
          if (streamingStartTime === 0) {
            streamingStartTime = audioContext.value.currentTime
            streamingElapsedTime = 0
            console.log('🎵 Starting streaming playback, initial time:', streamingStartTime)
          }
          startTime.value = audioContext.value.currentTime - streamingElapsedTime
          console.log('🔊 Chunk playback - elapsed:', streamingElapsedTime.toFixed(2), 'startTime:', startTime.value.toFixed(2))
          startProgressUpdates()
        }

        currentSource.value.start(0)
        currentSource.value.onended = () => {
          // Update elapsed time for next chunk
          if (streamingMode) {
            streamingElapsedTime += buffer.duration
            startTime.value = audioContext.value.currentTime - streamingElapsedTime
            console.log('🎵 Chunk ended, total elapsed:', streamingElapsedTime.toFixed(2), 'new startTime:', startTime.value.toFixed(2))
          }
          
          // After finishing this chunk, if more queued chunks exist use them.
          if (audioQueue.length > 0) {
            console.log('▶️ Playing next queued chunk, remaining:', audioQueue.length)
            playNextChunk(text, voice)
          } else if (isGenerating.value) {
            // Still generating? Wait a bit until the next chunk is fetched.
            setTimeout(() => playNextChunk(text, voice), 200)
          } else {
            // Generation complete and no queued chunk left => playback is finished.
            console.log('✅ Streaming playback complete')
            setIsPlaying(false)
            progressMessage.value = 'Playback complete!'
            stopProgressUpdates()
          }
        }

        // Continue fetching the next chunks if necessary.
        if (!isDownloadComplete.value) {
          fetchNextChunks(text, voice, isGenerating, unifiedBuffer, audioQueue, isDownloadComplete)
        }
      } else {
        // No queued chunk yet. If still generating, keep checking.
        if (isGenerating.value) {
          setTimeout(() => playNextChunk(text, voice), 200)
        }
      }
    } else {
      // User has taken an action (seek or play/pause) so we use the consolidated buffer.
      if (unifiedBuffer.value) {
        if (currentSource.value) {
          currentSource.value.onended = null
          currentSource.value.stop()
          currentSource.value.disconnect()
        }
        currentSource.value = audioContext.value.createBufferSource()
        currentSource.value.buffer = unifiedBuffer.value
        currentSource.value.connect(gainNode.value)
        currentSource.value.sessionId = currentSessionId

        if (!isPlaying.value) {
          setIsPlaying(true)
          startTime.value = audioContext.value.currentTime
          startProgressUpdates()
        }

        currentSource.value.start(0)
        currentSource.value.onended = () => {
          setIsPlaying(false)
          progressMessage.value = 'Playback complete!'
          stopProgressUpdates()
        }
      }
    }
  }
  // -----------------------------------------------------------------------------

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
      // For multi-speaker we immediately get a full WAV; so switch to unifiedBuffer mode:
      streamingMode = false
      
      // Reset to Web Audio mode for new generation
      if (isUsingHtmlAudio.value) {
        isUsingHtmlAudio.value = false
        if (htmlAudio.value) {
          htmlAudio.value.pause()
          htmlAudio.value.src = ''
          htmlAudio.value = null
        }
      }

      if (currentSource.value) {
        currentSource.value.onended = null
        currentSource.value.stop()
        currentSource.value.disconnect()
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
      updateUnifiedBuffer(
        await audioContext.value.decodeAudioData(arrayBuffer),
        setTotalDuration
      )
      setIsDownloadComplete(true)

      currentSource.value = audioContext.value.createBufferSource()
      currentSource.value.buffer = unifiedBuffer.value
      currentSource.value.connect(gainNode.value)
      currentSource.value.sessionId = sessionId
      setIsPlaying(true)
      startTime.value = audioContext.value.currentTime
      currentSource.value.start(0)
      startProgressUpdates()

      currentSource.value.onended = () => {
        setIsPlaying(false)
        progressMessage.value = 'Playback complete!'
        stopProgressUpdates()
      }

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
      }
    }
  }

  function setSyncedVolume(newVolumeValue) {
    // newVolumeValue is already normalized (0-1) from usePlayback
    // Just apply it directly to the audio context
    applyVolumeToAudioContext(newVolumeValue);
  }

  // When the user clicks play/pause we switch out of streaming mode.
  // If download is complete, switch to HTML5 Audio immediately.
  async function togglePlaybackHandler() {
    console.log('🎮 Toggle playback called - checking for HTML5 switch')
    const switched = await performHtmlAudioSwitch()
    if (switched) {
      console.log('✅ HTML5 Audio switch completed - skipping Web Audio togglePlayback')
      return
    }
    console.log('🔊 Using Web Audio playback')
    streamingMode = false
    await togglePlayback(unifiedBuffer)
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
    }
    setCurrentSource(null)
    if (audioContext.value) {
      closeAudio()
    }
    
    setSyncedVolume(80)
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
    
    // Reset HTML5 Audio switching flag
    switchingToHtml = false
    streamingMode = true
    
    // Reset HTML5 Audio mode
    if (isUsingHtmlAudio.value) {
      isUsingHtmlAudio.value = false
      if (htmlAudio.value) {
        htmlAudio.value.pause()
        htmlAudio.value.src = ''
        htmlAudio.value = null
      }
    }
  }

  async function downloadAudio() {
    await downloadAudioHelper(unifiedBuffer, isDownloadComplete, progressMessage)
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
    // When the user seeks, we also set streamingMode to false
    // If download is complete, switch to HTML5 Audio immediately.
    seekToPosition: async (pos) => { 
      console.log(`🎯 Seek to position ${pos}% called`)
      
      // Always switch to HTML5 Audio when seeking after download complete
      // This prevents dual audio playback issues
      if (isDownloadComplete.value && unifiedBuffer.value) {
        if (switchingToHtml) return // Prevent multiple rapid switches
        
        console.log('🔄 Force switching to HTML5 Audio for seeking')
        const targetTime = (pos / 100) * audioDuration.value
        
        switchingToHtml = true
        streamingMode = false
        
        // Stop current context playback immediately and aggressively
        if (currentSource.value) {
          console.log('⏹️ Stopping current Web Audio source for seek')
          currentSource.value.onended = null
          try {
            currentSource.value.stop()
            currentSource.value.disconnect()
          } catch (error) {
            console.log('Error stopping current source:', error.message)
          }
          setCurrentSource(null)
        }
        
        // Suspend audio context to fully stop Web Audio
        if (audioContext.value && audioContext.value.state !== 'suspended') {
          console.log('⏸️ Suspending audio context for seek')
          try {
            await audioContext.value.suspend()
          } catch (error) {
            console.log('Error suspending audio context:', error.message)
          }
        }
        
        setIsPlaying(false)
        stopProgressUpdates()
        
        // Switch to HTML5 Audio with target seek position
        console.log(`🎵 Creating HTML5 Audio and seeking to ${targetTime}s`)
        switchToHtmlAudio(unifiedBuffer.value, false, targetTime)
        
        // Reset the switching flag after a brief delay
        setTimeout(() => { switchingToHtml = false }, 100)
        return
      }
      
      console.log('🔊 Using Web Audio seeking')
      streamingMode = false;
      // Reset streaming time tracking when switching to unified buffer
      streamingStartTime = 0
      streamingElapsedTime = 0
      seekToPosition(pos, unifiedBuffer);
    },
    downloadAudio,
    audioDuration,
    currentTime,
    stopGeneration,
    // Also update seekRelative so that user interactions switch modes.
    seekRelative: async (offset) => {
      if (isDownloadComplete.value && unifiedBuffer.value) {
        if (switchingToHtml) return // Prevent multiple rapid switches
        
        // Calculate target time for HTML5 Audio
        const currentPlaybackTime = isPlaying.value
          ? audioContext.value.currentTime - startTime.value
          : currentTime.value
        const newTime = Math.max(0, Math.min(audioDuration.value, currentPlaybackTime + offset))
        
        switchingToHtml = true
        streamingMode = false
        
        // Stop current context playback immediately
        if (currentSource.value) {
          currentSource.value.onended = null
          try {
            currentSource.value.stop()
            currentSource.value.disconnect()
          } catch (error) {
            console.log('Error stopping current source:', error.message)
          }
          setCurrentSource(null)
        }
        
        // Suspend audio context to fully stop Web Audio
        if (audioContext.value && audioContext.value.state !== 'suspended') {
          try {
            await audioContext.value.suspend()
          } catch (error) {
            console.log('Error suspending audio context:', error.message)
          }
        }
        
        setIsPlaying(false)
        stopProgressUpdates()
        
        // Switch to HTML5 Audio with target seek position
        switchToHtmlAudio(unifiedBuffer.value, false, newTime)
        
        // Reset the switching flag after a brief delay
        setTimeout(() => { switchingToHtml = false }, 100)
        return
      }
      streamingMode = false;
      // Reset streaming time tracking when switching to unified buffer
      streamingStartTime = 0
      streamingElapsedTime = 0
      seekRelative(offset, unifiedBuffer);
    },
    unifiedBuffer
  }
} 