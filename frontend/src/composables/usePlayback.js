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

  function updatePlaybackProgress() {
    if (!isPlaying.value || !audioContext.value) return

    const elapsed = audioContext.value.currentTime - startTime.value
    if (totalDuration.value > 0) {
      setCurrentTime(Math.min(totalDuration.value, elapsed))
      setPlaybackProgress(Math.min(100, (elapsed / totalDuration.value) * 100))
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
    if (audioContext.value) {
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

    if (unifiedBuffer?.value && totalDuration.value > 0) {
      const newTime = (boundedPosition / 100) * totalDuration.value

      if (currentSource.value) {
        currentSource.value.onended = null
        currentSource.value.stop()
        currentSource.value.disconnect()
      }

      const newSource = audioContext.value.createBufferSource()
      newSource.buffer = unifiedBuffer.value
      newSource.connect(gainNode.value)
      setCurrentSource(newSource)

      startTime.value = audioContext.value.currentTime - newTime
      setCurrentTime(newTime)
      setPlaybackProgress(boundedPosition)

      if (isPlaying.value) {
        currentSource.value.start(0, newTime)
        startProgressUpdates()
      }

      currentSource.value.onended = () => {
        setIsPlaying(false)
        stopProgressUpdates()
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

  function handleVolumeChange(event, setVolume) {
    const newVol = parseInt(event.target.value)
    console.log('handleVolumeChange - raw value:', event.target.value)
    console.log('handleVolumeChange - parsed newVol:', newVol)
    console.log('handleVolumeChange - current volume.value before:', volume.value)
    setVolumeAndApply(newVol, setVolume)
    console.log('handleVolumeChange - current volume.value after:', volume.value)
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
    handleVolumeChange
  }
} 