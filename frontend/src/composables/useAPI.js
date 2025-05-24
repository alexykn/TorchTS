import { API_ENDPOINTS } from '../constants/api'

export function useAPI() {
  async function generateSpeechChunk({ text, voice, chunkId, speed = 1.0, signal }) {
    let response
    try {
      response = await fetch(API_ENDPOINTS.GENERATE_SPEECH, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, chunk_id: chunkId, speed })
      })
    } catch (error) {
      throw new Error(
        `Network error while generating speech chunk: ${error.message}`
      )
    }
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
    let response
    try {
      response = await fetch(API_ENDPOINTS.GENERATE_SPEECH_MULTI, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speakers, speed })
      })
    } catch (error) {
      throw new Error(
        `Network error while generating multi speech: ${error.message}`
      )
    }
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }
    const sessionId = response.headers.get('X-Session-ID')
    const arrayBuffer = await response.arrayBuffer()
    return { arrayBuffer, headers: response.headers, sessionId }
  }

  async function stopGeneration(sessionId) {
    let response
    try {
      response = await fetch(API_ENDPOINTS.STOP_GENERATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      })
    } catch (error) {
      throw new Error(
        `Network error while stopping generation: ${error.message}`
      )
    }
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error)
    }
    return await response.json()
  }

  async function getProfiles() {
    let response
    try {
      response = await fetch(API_ENDPOINTS.PROFILES)
    } catch (error) {
      throw new Error(
        `Network error while fetching profiles: ${error.message}`
      )
    }
    if (!response.ok) {
      throw new Error('Failed to load profiles')
    }
    return await response.json()
  }

  async function createProfile({ name, voice_preset, volume }) {
    let response
    try {
      response = await fetch(API_ENDPOINTS.PROFILES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, voice_preset, volume })
      })
    } catch (error) {
      throw new Error(
        `Network error while creating profile: ${error.message}`
      )
    }
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Failed to create profile')
    }
    return await response.json()
  }

  async function getProfileFiles(profileId) {
    let response
    try {
      response = await fetch(API_ENDPOINTS.PROFILE_FILES(profileId))
    } catch (error) {
      throw new Error(
        `Network error while fetching profile files: ${error.message}`
      )
    }
    if (!response.ok) {
      throw new Error('Failed to load profile files')
    }
    return await response.json()
  }

  async function getProfileAudio(profileId) {
    let response
    try {
      response = await fetch(API_ENDPOINTS.PROFILE_AUDIO(profileId))
    } catch (error) {
      throw new Error(
        `Network error while fetching profile audio: ${error.message}`
      )
    }
    if (!response.ok) {
      throw new Error('Failed to load profile audio')
    }
    return await response.json()
  }

  async function deleteProfile(profileId) {
    let response
    try {
      response = await fetch(`${API_ENDPOINTS.PROFILES}/${profileId}`, {
        method: 'DELETE'
      })
    } catch (error) {
      throw new Error(
        `Network error while deleting profile: ${error.message}`
      )
    }
    if (!response.ok) {
      throw new Error('Failed to delete profile')
    }
    return await response.json()
  }

  async function uploadFile(file, profileId) {
    const formData = new FormData()
    formData.append('file', file)
    let response
    try {
      response = await fetch(API_ENDPOINTS.PROFILE_FILES(profileId), {
        method: 'POST',
        body: formData
      })
    } catch (error) {
      throw new Error(`Network error while uploading file: ${error.message}`)
    }
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
    let response
    try {
      response = await fetch(API_ENDPOINTS.PROFILE_FILE(profileId, fileId), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      throw new Error(
        `Network error while deleting file: ${error.message}`
      )
    }
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.detail || errorData.error || 'Failed to delete file'
      )
    }
    return await response.json()
  }

  async function deleteAllFiles(profileId) {
    let response
    try {
      response = await fetch(API_ENDPOINTS.PROFILE_FILES(profileId), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      throw new Error(
        `Network error while deleting all files: ${error.message}`
      )
    }
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.detail || errorData.error || 'Failed to delete all files'
      )
    }
    return await response.json()
  }

  async function getFileContent(profileId, fileId) {
    let response
    try {
      response = await fetch(API_ENDPOINTS.PROFILE_FILE(profileId, fileId))
    } catch (error) {
      throw new Error(
        `Network error while fetching file content: ${error.message}`
      )
    }
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