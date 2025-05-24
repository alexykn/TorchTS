import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useTTSStore = defineStore('tts', () => {
  const volume = ref(80)
  const isGenerating = ref(false)
  const progressMessage = ref('')
  const unifiedBuffer = ref(null)
  const audioDuration = ref(0)

  function setVolume(val) {
    volume.value = val
  }

  function updateVolume(val, applyVolume) {
    setVolume(val)
    if (typeof applyVolume === 'function') {
      applyVolume(val / 100)
    }
  }

  function setUnifiedBuffer(buffer) {
    unifiedBuffer.value = buffer
    if (buffer) {
      audioDuration.value = buffer.duration
    } else {
      audioDuration.value = 0
    }
  }

  function updateUnifiedBuffer(buffer, setTotalDuration) {
    setUnifiedBuffer(buffer)
    if (typeof setTotalDuration === 'function') {
      setTotalDuration(buffer ? buffer.duration : 0)
    }
  }

  return {
    volume,
    isGenerating,
    progressMessage,
    unifiedBuffer,
    audioDuration,
    setVolume,
    setUnifiedBuffer,
    updateVolume,
    updateUnifiedBuffer
  }
})
