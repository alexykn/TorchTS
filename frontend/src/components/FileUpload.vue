<template>
    <v-card flat class="pa-4">
      <v-card-title class="text-h6">File Upload</v-card-title>
      <v-card-text>
        <div
          class="file-upload-area"
          @dragover="onDragOver"
          @drop="onFileDrop"
          @dragenter="onDragEnter"
          @dragleave="onDragLeave"
        >
          <input
            type="file"
            ref="fileInput"
            :accept="ACCEPTED_FILE_TYPES"
            multiple
            style="display: none"
            @change="onFileSelect"
            aria-label="Choose files to upload"
          >
          <div 
            class="upload-zone"
            :class="{ 'is-dragging': isDragging }"
            role="button"
            tabindex="0"
            aria-label="Click to choose a file or drag and drop here"
            @click="() => fileInput && fileInput.click()"
            @keydown.enter="() => fileInput && fileInput.click()"
            @keydown.space.prevent="() => fileInput && fileInput.click()"
          >
            <v-icon size="40" color="primary">mdi-file-upload</v-icon>
            <p class="mt-2">Drop files here or click to upload</p>
          </div>
          <div class="supported-formats" aria-label="Supported file formats">
            {{ SUPPORTED_FORMATS }}
          </div>
        </div>
        
        <div v-if="uploadedFiles.length > 0" class="mt-4">
          <v-card 
            v-for="file in uploadedFiles" 
            :key="file.id" 
            variant="outlined" 
            class="file-info mb-2"
            :class="{ 'cursor-pointer': true }"
            @click="onFileClickLocal(file)"
          >
            <v-card-text>
              <div class="d-flex align-center justify-space-between">
                <div>
                  <div class="text-subtitle-2">{{ file.name }}</div>
                  <div class="text-caption">{{ file.pages }} pages</div>
                </div>
                <v-btn
                  icon="mdi-close"
                  variant="text"
                  size="small"
                  @click.stop="onFileDelete(file.id)"
                ></v-btn>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </v-card-text>
    </v-card>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  import { ACCEPTED_FILE_TYPES, SUPPORTED_FORMATS } from '../constants/files'
  import { useFileUpload } from '../composables/useFileUpload'
  import { useProfiles } from '../composables/useProfile'

  const fileInput = ref(null)

  const {
    uploadedFiles,
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleFileSelect,
    handleFileDrop,
    handleFileClick,
    deleteFile
  } = useFileUpload()
  const { selectedProfile } = useProfiles()

  const emits = defineEmits(['fileSelect', 'fileClick'])

  function onDragOver(event) {
    handleDragOver(event)
  }
  function onDragEnter(event) {
    handleDragEnter(event)
  }
  function onDragLeave(event) {
    handleDragLeave(event)
  }
  async function onFileDrop(event) {
    await handleFileDrop(
      event,
      selectedProfile.value,
      (text) => emits('fileSelect', text),
      () => { if (fileInput.value) fileInput.value.value = '' }
    )
  }
  async function onFileSelect(event) {
    await handleFileSelect(
      event,
      selectedProfile.value,
      (text) => emits('fileSelect', text),
      () => { if (fileInput.value) fileInput.value.value = '' }
    )
  }
  async function onFileClickLocal(file) {
    if (!selectedProfile.value) return
    const content = await handleFileClick(selectedProfile.value, file, (c) => c)
    if (content) emits('fileClick', { file, content })
  }
  async function onFileDelete(fileId) {
    if (!selectedProfile.value) return
    await deleteFile(selectedProfile.value, fileId)
  }
  </script>