import { ref } from 'vue'
import { useFileUploadStore } from '../stores/fileUploadStore'
import { useAPI } from './useAPI'
import {
  MIME_TYPES,
  FILE_TYPE_LABELS,
  MAX_FILE_SIZE,
  getFileTypeByExtension,
  getFileTypeByMime
} from '../constants/files'

export function useFileUpload() {
  const fileStore = useFileUploadStore()
  const { uploadedFiles, progressMessage, isDragging, setUploadedFiles, setProgressMessage, setIsDragging } = fileStore
  const dragCounter = ref(0)

  // Internal helper for file validation; remains private
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
    setIsDragging(true)
  }

  function handleDragLeave(event) {
    event.preventDefault()
    dragCounter.value--
    if (dragCounter.value === 0) {
      setIsDragging(false)
    }
  }

  function handleDragOver(event) {
    event.preventDefault()
  }

  function handleDrop(event) {
    event.preventDefault()
    dragCounter.value = 0
    setIsDragging(false)
    // Return all dropped files as an Array
    return Array.from(event.dataTransfer.files)
  }

  // ---------------------------------------------------------------------
  // NEW FILE-PROCESSING FUNCTIONS
  // ---------------------------------------------------------------------

  /**
   * Process a single file upload.
   *
   * @param {File} file - File to upload.
   * @param {Number} profileId - Target profile identifier.
   * @param {Function} onSuccess - Callback to update (e.g.) text if upload returns content.
   * @param {Function} onFileInputReset - Callback to reset the file input (if necessary).
   * @returns {Promise<string>} - Returns the content extracted from the file.
   */
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

  /**
   * Handle file selection via a file input event.
   *
   * @param {Event} event - The input event from the file picker.
   * @param {Number} profileId - Target profile id.
   * @param {Function} onSuccess - Callback to update the text area on success.
   * @param {Function} onFileInputReset - Callback to reset the file input.
   */
  async function handleFileSelect(event, profileId, onSuccess, onFileInputReset) {
    const files = event.target.files
    for (let i = 0; i < files.length; i++) {
      await processFile(files[i], profileId, onSuccess, onFileInputReset)
    }
  }

  /**
   * Handle file drop event.
   *
   * @param {Event} event - The drop event.
   * @param {Number} profileId - Target profile id.
   * @param {Function} onSuccess - Callback to update the text area on success.
   * @param {Function} onFileInputReset - Callback to reset the file input.
   */
  async function handleFileDrop(event, profileId, onSuccess, onFileInputReset) {
    const files = handleDrop(event)
    for (let i = 0; i < files.length; i++) {
      await processFile(files[i], profileId, onSuccess, onFileInputReset)
    }
  }

  /**
   * Handle file click to fetch and return file content.
   *
   * @param {Number} profileId - Target profile id.
   * @param {Object} file - The file object which contains the file id.
   * @param {Function} onSuccess - Callback to update the text area on success.
   * @returns {Promise<string>} - File content if available.
   */
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

  return {
    // State
    uploadedFiles,
    progressMessage,
    isDragging,

    // File operations
    uploadFile,
    deleteFile,
    deleteAllFiles,
    setFiles: files => {
      setUploadedFiles(files)
    },

    // Drag and drop handlers
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,

    // New file processing functions
    processFile,
    handleFileSelect,
    handleFileDrop,
    handleFileClick,
  }
} 