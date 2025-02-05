import { API_ENDPOINTS } from '../constants/api'

export function useAPI() {
  async function generateSpeechChunk({ text, voice, chunkId, speed = 1.0, signal }) {
    const response = await fetch(API_ENDPOINTS.GENERATE_SPEECH, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, chunk_id: chunkId, speed })
    })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }
    const currentChunk = parseInt(response.headers.get('X-Current-Chunk'))
    const totalChunks = parseInt(response.headers.get('X-Total-Chunks'))
    const arrayBuffer = await response.arrayBuffer()
    return {
      arrayBuffer,
      headers: response.headers,
      currentChunk,
      totalChunks
    }
  }

  async function generateMultiSpeech({ text, speakers, speed = 1.0, signal }) {
    const response = await fetch(API_ENDPOINTS.GENERATE_SPEECH_MULTI, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speakers, speed })
    })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }
    const sessionId = response.headers.get('X-Session-ID')
    const arrayBuffer = await response.arrayBuffer()
    return { arrayBuffer, headers: response.headers, sessionId }
  }

  async function stopGeneration(sessionId) {
    const response = await fetch(API_ENDPOINTS.STOP_GENERATION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId })
    })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error)
    }
    return await response.json()
  }

  async function getProfiles() {
    const response = await fetch(API_ENDPOINTS.PROFILES)
    if (!response.ok) {
      throw new Error('Failed to load profiles')
    }
    return await response.json()
  }

  async function createProfile({ name, voice_preset, volume }) {
    const response = await fetch(API_ENDPOINTS.PROFILES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, voice_preset, volume })
    })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Failed to create profile')
    }
    return await response.json()
  }

  async function getProfileFiles(profileId) {
    const response = await fetch(API_ENDPOINTS.PROFILE_FILES(profileId))
    if (!response.ok) {
      throw new Error('Failed to load profile files')
    }
    return await response.json()
  }

  async function getProfileAudio(profileId) {
    const response = await fetch(API_ENDPOINTS.PROFILE_AUDIO(profileId))
    if (!response.ok) {
      throw new Error('Failed to load profile audio')
    }
    return await response.json()
  }

  async function deleteProfile(profileId) {
    const response = await fetch(`${API_ENDPOINTS.PROFILES}/${profileId}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error('Failed to delete profile')
    }
    return await response.json()
  }

  async function uploadFile(file, profileId) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(API_ENDPOINTS.PROFILE_FILES(profileId), {
      method: 'POST',
      body: formData
    })
    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch (e) {
        throw new Error(`Failed to parse error response: ${response.statusText}`)
      }
      throw new Error(
        errorData.detail || errorData.error || 'Failed to upload file'
      )
    }
    return await response.json()
  }

  async function deleteFile(profileId, fileId) {
    const response = await fetch(API_ENDPOINTS.PROFILE_FILE(profileId, fileId), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.detail || errorData.error || 'Failed to delete file'
      )
    }
    return await response.json()
  }

  async function deleteAllFiles(profileId) {
    const response = await fetch(API_ENDPOINTS.PROFILE_FILES(profileId), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.detail || errorData.error || 'Failed to delete all files'
      )
    }
    return await response.json()
  }

  async function getFileContent(profileId, fileId) {
    const response = await fetch(API_ENDPOINTS.PROFILE_FILE(profileId, fileId))
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.detail || errorData.error || 'Failed to fetch file content'
      )
    }
    return await response.json()
  }

  return {
    generateSpeechChunk,
    generateMultiSpeech,
    stopGeneration,
    getProfiles,
    createProfile,
    getProfileFiles,
    getProfileAudio,
    deleteProfile,
    uploadFile,
    deleteFile,
    deleteAllFiles,
    getFileContent
  }
} 