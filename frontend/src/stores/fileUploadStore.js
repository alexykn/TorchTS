import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useFileUploadStore = defineStore('fileUpload', () => {
  const uploadedFiles = ref([])
  const progressMessage = ref('')
  const isDragging = ref(false)

  function setUploadedFiles(files) {
    uploadedFiles.value = files
  }

  function setProgressMessage(msg) {
    progressMessage.value = msg
  }

  function setIsDragging(val) {
    isDragging.value = val
  }

  return {
    uploadedFiles,
    progressMessage,
    isDragging,
    setUploadedFiles,
    setProgressMessage,
    setIsDragging
  }
})
