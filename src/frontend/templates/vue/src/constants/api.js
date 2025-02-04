export const API_ENDPOINTS = {
  UPLOAD_FILE: import.meta.env.VITE_FILE_UPLOAD_URL || 'http://localhost:5005/upload-file',
  GENERATE_SPEECH: import.meta.env.VITE_GENERATE_SPEECH_URL || '/generate',
  GENERATE_SPEECH_MULTI: import.meta.env.VITE_GENERATE_SPEECH_MULTI_URL || '/generate_multi',
  STOP_GENERATION: import.meta.env.VITE_STOP_GENERATION_URL || 'http://localhost:5005/stop-generation',
  PROFILES: '/profiles',
  PROFILE_FILES: (profileId) => `/profiles/${profileId}/files`,
  PROFILE_FILE: (profileId, fileId) => `/profiles/${profileId}/files/${fileId}`,
  PROFILE_AUDIO: (profileId) => `/profiles/${profileId}/audio`
}