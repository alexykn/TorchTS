// audioHelpers.js - Utility functions for audio processing

export function concatenateAudioBuffers(audioContext, audioBuffers) {
  const totalLength = audioBuffers.reduce((acc, buffer) => acc + buffer.length, 0)
  const result = audioContext.createBuffer(
    1, // mono
    totalLength,
    audioBuffers[0].sampleRate
  )
  const channelData = result.getChannelData(0)
  let offset = 0
  for (const buffer of audioBuffers) {
    channelData.set(buffer.getChannelData(0), offset)
    offset += buffer.length
  }
  return result
}

export function audioBufferToWav(buffer) {
  const numChannels = 1
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample

  const wavDataBytes = buffer.length * blockAlign
  const headerBytes = 44
  const totalBytes = headerBytes + wavDataBytes

  const arrayBuffer = new ArrayBuffer(totalBytes)
  const dataView = new DataView(arrayBuffer)

  // RIFF identifier
  writeString(dataView, 0, 'RIFF')
  // RIFF chunk length
  dataView.setUint32(4, 36 + wavDataBytes, true)
  // RIFF type
  writeString(dataView, 8, 'WAVE')
  // Format chunk identifier
  writeString(dataView, 12, 'fmt ')
  // Format chunk length
  dataView.setUint32(16, 16, true)
  // Sample format (PCM)
  dataView.setUint16(20, format, true)
  // Channel count
  dataView.setUint16(22, numChannels, true)
  // Sample rate
  dataView.setUint32(24, sampleRate, true)
  // Byte rate (sample rate * block align)
  dataView.setUint32(28, sampleRate * blockAlign, true)
  // Block align
  dataView.setUint16(32, blockAlign, true)
  // Bits per sample
  dataView.setUint16(34, bitDepth, true)
  // Data chunk identifier
  writeString(dataView, 36, 'data')
  // Data chunk length
  dataView.setUint32(40, wavDataBytes, true)

  const channelData = buffer.getChannelData(0)
  let offset = 44
  for (let i = 0; i < channelData.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]))
    dataView.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
    offset += 2
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function writeString(dataView, offset, string) {
  for (let i = 0; i < string.length; i++) {
    dataView.setUint8(offset + i, string.charCodeAt(i))
  }
}
