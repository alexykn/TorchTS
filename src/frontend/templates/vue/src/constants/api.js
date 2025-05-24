export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5005'

export const API_ENDPOINTS = {
  UPLOAD_FILE:
    import.meta.env.VITE_FILE_UPLOAD_URL || `${API_BASE}/upload-file`,
  GENERATE_SPEECH:
    import.meta.env.VITE_GENERATE_SPEECH_URL || `${API_BASE}/generate`,
  GENERATE_SPEECH_MULTI:
    import.meta.env.VITE_GENERATE_SPEECH_MULTI_URL || `${API_BASE}/generate_multi`,
  STOP_GENERATION:
    import.meta.env.VITE_STOP_GENERATION_URL || `${API_BASE}/stop-generation`,
  PROFILES: `${API_BASE}/profiles`,
  PROFILE_FILES: (profileId) => `${API_BASE}/profiles/${profileId}/files`,
  PROFILE_FILE: (profileId, fileId) =>
    `${API_BASE}/profiles/${profileId}/files/${fileId}`,
  PROFILE_AUDIO: (profileId) => `${API_BASE}/profiles/${profileId}/audio`
}
