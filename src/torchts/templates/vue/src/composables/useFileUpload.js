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
  const uploadedFile = ref(null)
  const progressMessage = ref('')
  const isDragging = ref(null)
  const dragCounter = ref(0) // For more reliable drag state tracking

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

  async function uploadFile(file) {
    try {
      const fileType = validateFile(file)
      progressMessage.value = `Uploading ${FILE_TYPE_LABELS[fileType]} file...`
      
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(API_ENDPOINTS.UPLOAD_FILE, {
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
      uploadedFile.value = {
        name: file.name,
        type: FILE_TYPE_LABELS[fileType],
        pages: result.pages || 1
      }
      
      progressMessage.value = result.pages 
        ? `File uploaded successfully: ${result.pages} pages`
        : 'File uploaded successfully'
        
      return result.text
    } catch (error) {
      console.error('Error uploading file:', error)
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
    return event.dataTransfer.files[0]
  }

  function clearFile() {
    uploadedFile.value = null
    progressMessage.value = ''
  }

  return { 
    // State
    uploadedFile,
    progressMessage,
    isDragging,
    
    // Methods
    uploadFile,
    validateFile,
    clearFile,
    
    // Drag and drop handlers
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop
  }
} 