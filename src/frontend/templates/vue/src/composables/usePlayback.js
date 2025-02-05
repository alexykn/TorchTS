import { ref } from 'vue'

export function usePlayback(audioContext, gainNode) {
  const isPlaying = ref(false)
  const currentSource = ref(null)
  const startTime = ref(0)
  const pausedTime = ref(0)
  const currentTime = ref(0)
  const playbackProgress = ref(0)
  const volume = ref(80)
  const totalDuration = ref(0)

  function updatePlaybackProgress() {
    if (!isPlaying.value || !audioContext.value) return

    const elapsed = audioContext.value.currentTime - startTime.value
    if (totalDuration.value > 0) {
      currentTime.value = Math.min(totalDuration.value, elapsed)
      playbackProgress.value = Math.min(100, (elapsed / totalDuration.value) * 100)
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
      currentTime.value = Math.min(totalDuration.value, elapsed)
      playbackProgress.value = Math.min(100, (elapsed / totalDuration.value) * 100)
    }
  }

  function setTotalDuration(duration) {
    totalDuration.value = duration
    currentTime.value = 0
    playbackProgress.value = 0
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

      currentSource.value = audioContext.value.createBufferSource()
      currentSource.value.buffer = unifiedBuffer.value
      currentSource.value.connect(gainNode.value)

      startTime.value = audioContext.value.currentTime - newTime
      currentTime.value = newTime
      playbackProgress.value = boundedPosition

      if (isPlaying.value) {
        currentSource.value.start(0, newTime)
        startProgressUpdates()
      }

      currentSource.value.onended = () => {
        isPlaying.value = false
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
      isPlaying.value = false
      await audioContext.value.suspend()
      pausedTime.value = audioContext.value.currentTime - startTime.value
      stopProgressUpdates()
    } else {
      await audioContext.value.resume()
      startTime.value = audioContext.value.currentTime - pausedTime.value
      isPlaying.value = true
      if (unifiedBuffer && unifiedBuffer.value) {
        requestAnimationFrame(updatePlaybackProgress)
      }
    }
  }

  function handleVolumeChange(event, setVolume) {
    const newVol = parseFloat(event.target.value) / 100
    volume.value = parseInt(event.target.value)
    setVolume(newVol)
    event.target.style.setProperty('--volume-percentage', `${volume.value}%`)
  }

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