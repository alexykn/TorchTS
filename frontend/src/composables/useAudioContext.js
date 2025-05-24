import { ref } from 'vue'
import { useTTSStore } from '../stores/ttsStore';

export function useAudioContext() {
  const audioContext = ref(null)
  const gainNode = ref(null)

  function initAudio() {
    if (!audioContext.value) {
      audioContext.value = new (window.AudioContext || window.webkitAudioContext)()
      gainNode.value = audioContext.value.createGain()
      gainNode.value.connect(audioContext.value.destination)

      // Initialize gainNode's volume from the store's current volume
      const ttsStore = useTTSStore();
      // The store volume is 0-100, gainNode.gain.value expects 0-1
      const initialVolume = ttsStore.volume / 100; 
      gainNode.value.gain.value = initialVolume;
    }
  }

  function setVolume(volume) {
    console.log('useAudioContext setVolume - input volume:', volume)
    if (gainNode.value) {
      console.log('useAudioContext setVolume - gainNode exists, setting gain value')
      gainNode.value.gain.value = volume
      console.log('useAudioContext setVolume - gainNode.gain.value after:', gainNode.value.gain.value)
    } else {
      console.log('useAudioContext setVolume - gainNode is null/undefined')
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
