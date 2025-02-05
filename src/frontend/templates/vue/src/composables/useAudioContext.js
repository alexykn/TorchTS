import { ref } from 'vue'

export function useAudioContext() {
  const audioContext = ref(null)
  const gainNode = ref(null)

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

  function closeAudio() {
    if (audioContext.value) {
      audioContext.value.close()
      audioContext.value = null
      gainNode.value = null
    }
  }

  return {
    audioContext,
    gainNode,
    initAudio,
    setVolume,
    closeAudio
  }
}
