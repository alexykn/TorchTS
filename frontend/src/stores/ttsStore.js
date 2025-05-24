import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useTTSStore = defineStore('tts', () => {
  const volume = ref(80)
  const isGenerating = ref(false)
  const progressMessage = ref('')
  const unifiedBuffer = ref(null)
  const audioDuration = ref(0)

  // Playback state
  const isPlaying = ref(false)
  const currentSource = ref(null)
  console.log('currentSource created in ttsStore:', currentSource);
  console.log('typeof currentSource in ttsStore:', typeof currentSource);
  const playbackProgress = ref(0)
  const currentTime = ref(0)

  // Download state
  const isDownloadComplete = ref(false)
  const downloadProgress = ref(0)

  function setVolume(val) {
    volume.value = val
  }

  function setUnifiedBuffer(buffer) {
    unifiedBuffer.value = buffer
    if (buffer) {
      audioDuration.value = buffer.duration
    } else {
      audioDuration.value = 0
    }
  }

  // Playback actions
  function setIsPlaying(val) {
    isPlaying.value = val
  }

  function setCurrentSource(source) {
    currentSource.value = source
  }

  function setPlaybackProgress(progress) {
    playbackProgress.value = progress
  }

  function setCurrentTime(time) {
    currentTime.value = time
  }

  // Download actions
  function setIsDownloadComplete(val) {
    isDownloadComplete.value = val
  }

  function setDownloadProgress(val) {
    downloadProgress.value = val
  }

  function setVolumeAndApply(val, applyFn) {
    console.log('setVolumeAndApply - input val:', val)
    console.log('setVolumeAndApply - volume.value before:', volume.value)
    volume.value = val
    console.log('setVolumeAndApply - volume.value after:', volume.value)
    if (typeof applyFn === 'function') {
      const normalizedVal = val / 100
      console.log('setVolumeAndApply - calling applyFn with normalized value:', normalizedVal)
      applyFn(normalizedVal)
    }
  }

  function updateUnifiedBuffer(buffer, setDuration) {
    setUnifiedBuffer(buffer)
    if (typeof setDuration === 'function') {
      const duration = buffer ? buffer.duration : 0
      setDuration(duration)
    }
  }

  console.log('About to return from ttsStore. currentSource is:', currentSource);
  
  return {
    volume,
    isGenerating,
    progressMessage,
    unifiedBuffer,
    audioDuration,
    isPlaying,
    currentSource,
    playbackProgress,
    currentTime,
    isDownloadComplete,
    downloadProgress,
    setVolume,
    setUnifiedBuffer,
    setIsPlaying,
    setCurrentSource,
    setPlaybackProgress,
    setCurrentTime,
    setIsDownloadComplete,
    setDownloadProgress,
    setVolumeAndApply,
    updateUnifiedBuffer
  }
})
