import { audioBufferToWav } from '../utils/audioHelpers'

export async function downloadAudio(unifiedBuffer, isDownloadComplete, progressMessage) {
  if (!unifiedBuffer.value || !isDownloadComplete.value) return

  try {
    const offlineCtx = new OfflineAudioContext(
      1,
      unifiedBuffer.value.length,
      unifiedBuffer.value.sampleRate
    )

    const source = offlineCtx.createBufferSource()
    source.buffer = unifiedBuffer.value
    source.connect(offlineCtx.destination)
    source.start()

    const renderedBuffer = await offlineCtx.startRendering()
    const wavBlob = audioBufferToWav(renderedBuffer)

    const url = URL.createObjectURL(wavBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'audio.wav'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading audio:', error)
    progressMessage.value = `Error downloading: ${error.message}`
  }
} 