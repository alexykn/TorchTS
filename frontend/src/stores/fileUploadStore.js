import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAPI } from '../composables/useAPI'
import {
  MIME_TYPES,
  FILE_TYPE_LABELS,
  MAX_FILE_SIZE,
  getFileTypeByExtension,
  getFileTypeByMime
} from '../constants/files'

export const useFileUploadStore = defineStore('fileUpload', () => {
  const uploadedFiles = ref([])
  const progressMessage = ref('')
  const isDragging = ref(false)
  const dragCounter = ref(0)
  const currentFileId = ref(null)
  const originalFileContent = ref('')

  function setCurrentFileId(val) {
    currentFileId.value = val
  }

  function setOriginalFileContent(val) {
    originalFileContent.value = val
  }

  function setFiles(files) {
    uploadedFiles.value = files
  }

  function validateFile(file) {
    if (!file) {
      throw new Error('No file provided')
    }

    const fileType =
      getFileTypeByMime(file.type) || getFileTypeByExtension(file.name)
    if (!fileType) {
      throw new Error(
        'Please upload a valid PDF, TXT, MD, DOCX, or ODT file'
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 10MB limit')
    }

    return fileType
  }

  async function uploadFile(file, profileId) {
    try {
      const fileType = validateFile(file)
      progressMessage.value = `Uploading ${FILE_TYPE_LABELS[fileType]} file...`

      const api = useAPI()
      const result = await api.uploadFile(file, profileId)

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
      progressMessage.value = 'Deleting file...'
      const api = useAPI()
      await api.deleteFile(profileId, fileId)
      uploadedFiles.value = uploadedFiles.value.filter(
        (f) => f.id !== fileId
      )
      progressMessage.value = 'File deleted successfully'
    } catch (error) {
      console.error('Error deleting file:', error)
      progressMessage.value = `Error: ${error.message}`
      throw error
    }
  }

  async function deleteAllFiles(profileId) {
    try {
      progressMessage.value = 'Deleting all files...'
      const api = useAPI()
      await api.deleteAllFiles(profileId)
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
    return Array.from(event.dataTransfer.files)
  }

  async function processFile(file, profileId, onSuccess, onFileInputReset) {
    if (file && profileId) {
      try {
        const extractedText = await uploadFile(file, profileId)
        if (extractedText && typeof onSuccess === 'function') {
          onSuccess(extractedText)
        }
        return extractedText
      } catch (error) {
        if (typeof onFileInputReset === 'function') {
          onFileInputReset()
        }
        throw error
      }
    }
  }

  async function handleFileSelect(event, profileId, onSuccess, onFileInputReset) {
    const files = event.target.files
    for (let i = 0; i < files.length; i++) {
      await processFile(files[i], profileId, onSuccess, onFileInputReset)
    }
  }

  async function handleFileDrop(event, profileId, onSuccess, onFileInputReset) {
    const files = handleDrop(event)
    for (let i = 0; i < files.length; i++) {
      await processFile(files[i], profileId, onSuccess, onFileInputReset)
    }
  }

  async function handleFileClick(profileId, file, onSuccess) {
    if (!profileId) {
      throw new Error('No profile id provided')
    }
    try {
      const api = useAPI()
      const data = await api.getFileContent(profileId, file.id)
      if (data && data.content) {
        if (typeof onSuccess === 'function') {
          onSuccess(data.content)
        }
        return data.content
      }
    } catch (error) {
      console.error('Error loading file content:', error)
      throw error
    }
  }

  function clearCurrentFileIfTextEdited(newText) {
    if (currentFileId.value && newText !== originalFileContent.value) {
      currentFileId.value = null
    }
  }

  return {
    uploadedFiles,
    progressMessage,
    isDragging,
    dragCounter,
    currentFileId,
    originalFileContent,
    setCurrentFileId,
    setOriginalFileContent,
    setFiles,
    uploadFile,
    deleteFile,
    deleteAllFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    processFile,
    handleFileSelect,
    handleFileDrop,
    handleFileClick,
    clearCurrentFileIfTextEdited
  }
})
