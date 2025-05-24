import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useFileUploadStore = defineStore('fileUpload', () => {
  const currentFileId = ref(null)
  const originalFileContent = ref('')

  function setCurrentFile(id, content = '') {
    currentFileId.value = id
    originalFileContent.value = content
  }

  function clearCurrentFileIfTextEdited(newText) {
    if (currentFileId.value && newText !== originalFileContent.value) {
      currentFileId.value = null
    }
  }

  return {
    currentFileId,
    originalFileContent,
    setCurrentFile,
    clearCurrentFileIfTextEdited
  }
})
