import { storeToRefs } from 'pinia'
import { useFileUploadStore } from '../stores/fileUploadStore'

export function useFileUpload() {
  const store = useFileUploadStore()
  const {
    uploadedFiles,
    progressMessage,
    isDragging,
    dragCounter,
    currentFileId,
    originalFileContent
  } = storeToRefs(store)

  return {
    uploadedFiles,
    progressMessage,
    isDragging,
    dragCounter,
    currentFileId,
    originalFileContent,
    uploadFile: store.uploadFile,
    deleteFile: store.deleteFile,
    deleteAllFiles: store.deleteAllFiles,
    setFiles: store.setFiles,
    handleDragEnter: store.handleDragEnter,
    handleDragLeave: store.handleDragLeave,
    handleDragOver: store.handleDragOver,
    handleDrop: store.handleDrop,
    processFile: store.processFile,
    handleFileSelect: store.handleFileSelect,
    handleFileDrop: store.handleFileDrop,
    handleFileClick: store.handleFileClick,
    setCurrentFileId: store.setCurrentFileId,
    setOriginalFileContent: store.setOriginalFileContent
  }
}
