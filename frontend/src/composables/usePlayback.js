import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTTSStore } from '../stores/ttsStore'

export function usePlayback(audioContext, gainNode) {
  const ttsStore = useTTSStore()
  const {
    volume,
    isPlaying,
    currentSource,
    playbackProgress,
    currentTime
  } = storeToRefs(ttsStore)
  const {
    setVolumeAndApply,
    setIsPlaying,
    setCurrentSource,
    setPlaybackProgress,
    setCurrentTime
  } = ttsStore
  
  console.log('currentSource from ttsStore in usePlayback:', currentSource);
  console.log('typeof currentSource from ttsStore:', typeof currentSource);
  const startTime = ref(0)
  const pausedTime = ref(0)
  const totalDuration = ref(0)
  
  // HTML5 Audio for post-generation playback
  const htmlAudio = ref(null)
  const isUsingHtmlAudio = ref(false)
  const audioBlob = ref(null)

  function updatePlaybackProgress() {
    if (!isPlaying.value) return

    if (isUsingHtmlAudio.value && htmlAudio.value) {
      // Use HTML5 Audio progress
      const currentTime = htmlAudio.value.currentTime
      const duration = htmlAudio.value.duration || totalDuration.value
      
      setCurrentTime(currentTime)
      if (duration > 0) {
        setPlaybackProgress((currentTime / duration) * 100)
      }
    } else if (audioContext.value) {
      // Use Web Audio API progress
      const elapsed = audioContext.value.currentTime - startTime.value
      if (totalDuration.value > 0) {
        setCurrentTime(Math.min(totalDuration.value, elapsed))
        setPlaybackProgress(Math.min(100, (elapsed / totalDuration.value) * 100))
      }
    }

    if (isPlaying.value) {
      requestAnimationFrame(updatePlaybackProgress)
    }
  }

  function startProgressUpdates() {
    if (!isPlaying.value) return
    requestAnimationFrame(updatePlaybackProgress)
  }

  function stopProgressUpdates() {
    if (isUsingHtmlAudio.value && htmlAudio.value) {
      const currentTime = htmlAudio.value.currentTime
      const duration = htmlAudio.value.duration || totalDuration.value
      setCurrentTime(currentTime)
      if (duration > 0) {
        setPlaybackProgress((currentTime / duration) * 100)
      }
    } else if (audioContext.value) {
      const elapsed = audioContext.value.currentTime - startTime.value
      setCurrentTime(Math.min(totalDuration.value, elapsed))
      setPlaybackProgress(Math.min(100, (elapsed / totalDuration.value) * 100))
    }
  }

  function setTotalDuration(duration) {
    totalDuration.value = duration
    setCurrentTime(0)
    setPlaybackProgress(0)
  }

  function seekToPosition(position, unifiedBuffer) {
    const boundedPosition = Math.max(0, Math.min(100, position))

    if (isUsingHtmlAudio.value && htmlAudio.value) {
      // Use HTML5 Audio for seeking
      const newTime = (boundedPosition / 100) * totalDuration.value
      htmlAudio.value.currentTime = newTime
      setCurrentTime(newTime)
      setPlaybackProgress(boundedPosition)
      
      if (isPlaying.value && htmlAudio.value.paused) {
        htmlAudio.value.play()
      }
    } else if (unifiedBuffer?.value && totalDuration.value > 0) {
      // Use Web Audio API for seeking (during streaming)
      const newTime = (boundedPosition / 100) * totalDuration.value

      if (currentSource.value) {
        try {
          currentSource.value.onended = null
          currentSource.value.stop()
          currentSource.value.disconnect()
        } catch (error) {
          // AudioBufferSourceNode might already be stopped
          console.log('AudioBufferSourceNode already stopped:', error.message)
        }
      }

      const newSource = audioContext.value.createBufferSource()
      newSource.buffer = unifiedBuffer.value
      newSource.connect(gainNode.value)
      setCurrentSource(newSource)

      startTime.value = audioContext.value.currentTime - newTime
      setCurrentTime(newTime)
      setPlaybackProgress(boundedPosition)

      if (isPlaying.value) {
        newSource.start()
        startProgressUpdates()
      }
    }
  }

  function seekRelative(offsetSeconds, unifiedBuffer) {
    if (unifiedBuffer?.value && totalDuration.value > 0) {
      const currentPlaybackTime = isPlaying.value
        ? audioContext.value.currentTime - startTime.value
        : currentTime.value
      const newTime = Math.max(0, Math.min(totalDuration.value, currentPlaybackTime + offsetSeconds))
      const newPosition = (newTime / totalDuration.value) * 100
      seekToPosition(newPosition, unifiedBuffer)
    }
  }

  async function togglePlayback(unifiedBuffer) {
    if (isUsingHtmlAudio.value && htmlAudio.value) {
      // Use HTML5 Audio playback
      if (isPlaying.value) {
        htmlAudio.value.pause()
        setIsPlaying(false)
        stopProgressUpdates()
      } else {
        try {
          await htmlAudio.value.play()
          setIsPlaying(true)
          startProgressUpdates()
        } catch (error) {
          console.error('HTML5 Audio play failed:', error)
        }
      }
    } else {
      // Use Web Audio API playback
      if (!currentSource.value) return

      if (isPlaying.value) {
        setIsPlaying(false)
        await audioContext.value.suspend()
        pausedTime.value = audioContext.value.currentTime - startTime.value
        stopProgressUpdates()
      } else {
        await audioContext.value.resume()
        startTime.value = audioContext.value.currentTime - pausedTime.value
        setIsPlaying(true)
        if (unifiedBuffer && unifiedBuffer.value) {
          requestAnimationFrame(updatePlaybackProgress)
        }
      }
    }
  }

  function switchToHtmlAudio(audioBuffer) {
    if (!audioBuffer) return
    
    try {
      // Convert AudioBuffer to blob
      const numberOfChannels = audioBuffer.numberOfChannels
      const sampleRate = audioBuffer.sampleRate
      const arrayBuffer = new ArrayBuffer(44 + audioBuffer.length * numberOfChannels * 2)
      const view = new DataView(arrayBuffer)
      
      // Write WAV header
      const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i))
        }
      }
      
      writeString(0, 'RIFF')
      view.setUint32(4, 36 + audioBuffer.length * numberOfChannels * 2, true)
      writeString(8, 'WAVE')
      writeString(12, 'fmt ')
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true)
      view.setUint16(22, numberOfChannels, true)
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * numberOfChannels * 2, true)
      view.setUint16(32, numberOfChannels * 2, true)
      view.setUint16(34, 16, true)
      writeString(36, 'data')
      view.setUint32(40, audioBuffer.length * numberOfChannels * 2, true)
      
      // Write audio data
      let offset = 44
      for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
          offset += 2
        }
      }
      
      audioBlob.value = new Blob([arrayBuffer], { type: 'audio/wav' })
      
      // Create HTML5 Audio element
      if (htmlAudio.value) {
        htmlAudio.value.remove()
      }
      
      htmlAudio.value = new Audio()
      htmlAudio.value.src = URL.createObjectURL(audioBlob.value)
      htmlAudio.value.volume = (volume.value || 80) / 100
      
      htmlAudio.value.onended = () => {
        setIsPlaying(false)
        setCurrentTime(totalDuration.value)
        setPlaybackProgress(100)
        stopProgressUpdates()
      }
      
      htmlAudio.value.ontimeupdate = () => {
        if (isPlaying.value && isUsingHtmlAudio.value) {
          updatePlaybackProgress()
        }
      }
      
      isUsingHtmlAudio.value = true
      console.log('Switched to HTML5 Audio for replay')
      
    } catch (error) {
      console.error('Failed to create HTML5 Audio:', error)
    }
  }

  function handleVolumeChange(event, setVolume) {
    const newVol = parseInt(event.target.value)
    console.log('handleVolumeChange - raw value:', event.target.value)
    console.log('handleVolumeChange - parsed newVol:', newVol)
    console.log('handleVolumeChange - current volume.value before:', volume.value)
    setVolumeAndApply(newVol, setVolume)
    console.log('handleVolumeChange - current volume.value after:', volume.value)
    
    // Apply volume to HTML5 Audio if using it
    if (isUsingHtmlAudio.value && htmlAudio.value) {
      htmlAudio.value.volume = newVol / 100
    }
    
    // Only set CSS property if the target has a style object (real DOM element)
    if (event.target.style && event.target.style.setProperty) {
      event.target.style.setProperty('--volume-percentage', `${volume.value}%`)
    }
  }

  console.log('About to return from usePlayback. currentSource is:', currentSource);
  console.log('typeof currentSource before return:', typeof currentSource);
  
  return {
    isPlaying,
    currentSource,
    startTime,
    pausedTime,
    currentTime,
    playbackProgress,
    volume,
    totalDuration,
    updatePlaybackProgress,
    startProgressUpdates,
    stopProgressUpdates,
    setTotalDuration,
    seekToPosition,
    seekRelative,
    togglePlayback,
    handleVolumeChange,
    switchToHtmlAudio,
    isUsingHtmlAudio,
    htmlAudio
  }
} 