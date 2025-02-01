export const API_ENDPOINTS = {
  UPLOAD_FILE: import.meta.env.VITE_FILE_UPLOAD_URL || 'http://localhost:5005/upload-file',
  GENERATE_SPEECH: import.meta.env.VITE_GENERATE_SPEECH_URL || '/generate'
} 