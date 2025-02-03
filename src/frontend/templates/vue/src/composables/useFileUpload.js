import { ref } from 'vue'
import { API_ENDPOINTS } from '../constants/api'
import {
  MIME_TYPES,
  FILE_TYPE_LABELS,
  MAX_FILE_SIZE,
  getFileTypeByExtension,
  getFileTypeByMime
} from '../constants/files'

export function useFileUpload() {
  const uploadedFiles = ref([])
  const progressMessage = ref('')
  const isDragging = ref(null)
  const dragCounter = ref(0)

  function validateFile(file) {
    if (!file) {
      throw new Error('No file provided')
    }

    // Get file type from MIME type or extension
    const fileType = getFileTypeByMime(file.type) || getFileTypeByExtension(file.name)
    if (!fileType) {
      throw new Error('Please upload a valid PDF, TXT, MD, DOCX, or ODT file')
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 10MB limit')
    }

    return fileType
  }

  async function uploadFile(file, profileId) {
    try {
      const fileType = validateFile(file)
      progressMessage.value = `Uploading ${FILE_TYPE_LABELS[fileType]} file...`
      
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(`${API_ENDPOINTS.PROFILE_FILES(profileId)}`, {
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
        throw new Error(errorData.detail || errorData.error || 'Failed to upload file')
      }
      
      const result = await response.json()
      const newFile = {
        id: result.id,
        name: result.filename,
        type: FILE_TYPE_LABELS[fileType],
        pages: result.pages || 1,
        created_at: result.created_at
      }
      
      uploadedFiles.value.push(newFile)
      
      progressMessage.value = result.pages 
        ? `File uploaded successfully: ${result.pages} pages`
        : 'File uploaded successfully'
        
      return result.content
    } catch (error) {
      console.error('Error uploading file:', error)
      progressMessage.value = `Error: ${error.message}`
      throw error
    }
  }

  async function deleteFile(profileId, fileId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.PROFILE_FILE(profileId, fileId)}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete file')
      }
      
      uploadedFiles.value = uploadedFiles.value.filter(f => f.id !== fileId)
      progressMessage.value = 'File deleted successfully'
    } catch (error) {
      console.error('Error deleting file:', error)
      progressMessage.value = `Error: ${error.message}`
      throw error
    }
  }

  async function deleteAllFiles(profileId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.PROFILE_FILES(profileId)}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete all files')
      }
      
      uploadedFiles.value = []
      progressMessage.value = 'All files deleted successfully'
      return true
    } catch (error) {
      console.error('Error deleting all files:', error)
      progressMessage.value = `Error: ${error.message}`
      throw error
    }
  }

  function handleDragEnter(event) {
    event.preventDefault()
    dragCounter.value++
    isDragging.value = true
  }

  function handleDragLeave(event) {
    event.preventDefault()
    dragCounter.value--
    if (dragCounter.value === 0) {
      isDragging.value = false
    }
  }

  function handleDragOver(event) {
    event.preventDefault()
  }

  function handleDrop(event) {
    event.preventDefault()
    dragCounter.value = 0
    isDragging.value = false
    // Return all dropped files as an Array
    return Array.from(event.dataTransfer.files)
  }

  function clearFiles() {
    uploadedFiles.value = []
    progressMessage.value = ''
  }

  function setFiles(files) {
    uploadedFiles.value = files
  }

  return { 
    // State
    uploadedFiles,
    progressMessage,
    isDragging,
    
    // Methods
    uploadFile,
    deleteFile,
    deleteAllFiles,
    validateFile,
    clearFiles,
    setFiles,
    
    // Drag and drop handlers
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop
  }
} 