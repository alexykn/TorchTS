import { ref } from 'vue'
import { useAPI } from './useAPI'
import { concatenateAudioBuffers } from '../utils/audioHelpers'
import { useTTSStore } from '../stores/ttsStore'

export function useAudioChunks(audioContext) {
  const ttsStore = useTTSStore()
  const { downloadProgress, setDownloadProgress } = ttsStore
  const chunkCache = new Map()
  const currentChunkIndex = ref(0)
  let totalChunks = 0
  let validatedTotalChunks = null
  let isFetching = false
  let currentAbortController = null

  async function fetchAudioChunk(text, voice, chunkId, isGenerating, retryCount = 0) {
    try {
      currentAbortController = new AbortController()
      const timeoutId = setTimeout(
        () => currentAbortController.abort(),
        50000
      ) // 50s timeout

      const api = useAPI()
      const chunkResponse = await api.generateSpeechChunk({
        text,
        voice,
        chunkId,
        speed: 1.0,
        signal: currentAbortController.signal
      })

      clearTimeout(timeoutId)

      const currentChunk = chunkResponse.currentChunk
      const newTotalChunks = chunkResponse.totalChunks

      if (validatedTotalChunks === null) {
        validatedTotalChunks = newTotalChunks
        totalChunks = newTotalChunks
      } else if (newTotalChunks !== validatedTotalChunks) {
        throw new Error('Inconsistent total chunks received from server')
      }

      const arrayBuffer = chunkResponse.arrayBuffer
      const audioBuffer = await audioContext.value.decodeAudioData(arrayBuffer)

      if (!chunkCache.has(currentChunk)) {
        chunkCache.set(currentChunk, audioBuffer)
        setDownloadProgress(Math.round((chunkCache.size / totalChunks) * 100))
      }

      return {
        buffer: audioBuffer,
        currentChunk,
        totalChunks: validatedTotalChunks,
        headers: chunkResponse.headers
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('cancelled')) {
        console.warn(`Fetch for chunk ${chunkId} aborted/cancelled`)
        throw error
      }
      if (!isGenerating.value) {
        throw error
      }
      if (retryCount < 3) {
        console.warn(`Retrying chunk ${chunkId} (attempt ${retryCount + 1}): ${error.message}`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return fetchAudioChunk(text, voice, chunkId, isGenerating, retryCount + 1)
      }
      throw new Error(`Failed to fetch chunk ${chunkId} after 3 attempts: ${error.message}`)
    }
  }

  async function fetchNextChunks(text, voice, isGenerating, unifiedBuffer, audioQueue, isDownloadComplete) {
    if (isFetching || currentChunkIndex.value >= totalChunks || !isGenerating.value) return

    isFetching = true
    try {
      while (currentChunkIndex.value < totalChunks && isGenerating.value) {
        const nextChunkId = currentChunkIndex.value
        
        if (!chunkCache.has(nextChunkId)) {
          window.dispatchEvent(new CustomEvent('chunk-progress', {
            detail: { message: `Fetching chunk ${currentChunkIndex.value + 1}/${totalChunks}` }
          }))
          
          const chunk = await fetchAudioChunk(text, voice, nextChunkId, isGenerating)
          if (!unifiedBuffer.value && chunk) {
            audioQueue.push(chunk.buffer)
          }
        } else if (!unifiedBuffer.value) {
          audioQueue.push(chunkCache.get(nextChunkId))
        }

        currentChunkIndex.value++
      }

      if (currentChunkIndex.value >= totalChunks && !unifiedBuffer.value) {
        const buffers = [];
        for (let i = 0; i < totalChunks; i++) {
          if (chunkCache.has(i)) {
            buffers.push(chunkCache.get(i));
          } else {
            console.warn(`Missing chunk ${i} in chunkCache.`);
          }
        }
        const concatenatedBuffer = concatenateAudioBuffers(audioContext.value, buffers);
        unifiedBuffer.value = concatenatedBuffer;
        if (concatenatedBuffer) {
          window.dispatchEvent(new CustomEvent('audio-duration-set', {
            detail: { duration: concatenatedBuffer.duration }
          }));
        }
        isDownloadComplete.value = true;
        window.dispatchEvent(new CustomEvent('chunk-progress', {
          detail: { message: 'Ready to play' }
        }));
      }
    } catch (error) {
      console.error('Error fetching next chunks:', error)
      throw error
    } finally {
      isFetching = false
    }
  }

  function resetChunks() {
    validatedTotalChunks = null
    totalChunks = 0
    currentChunkIndex.value = 0
    isFetching = false
    currentAbortController = null
    chunkCache.clear()
  }

  return {
    chunkCache,
    currentChunkIndex,
    fetchAudioChunk,
    fetchNextChunks,
    getTotalChunks: () => totalChunks,
    resetChunks
  }
} 