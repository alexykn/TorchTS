<template>
    <v-card flat class="pa-4">
      <v-card-title class="text-h6">File Upload</v-card-title>
      <v-card-text>
        <div 
          class="file-upload-area" 
          @dragover="handleDragOver"
          @drop="handleFileDrop"
          @dragenter="handleDragEnter"
          @dragleave="handleDragLeave"
        >
          <input
            type="file"
            ref="fileInput"
            :accept="ACCEPTED_FILE_TYPES"
            multiple
            style="display: none"
            @change="handleFileSelect"
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
            @click="onFileClick(file)"
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
                  @click.stop="handleFileDelete(file.id)"
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
  
  const props = defineProps({
    uploadedFiles: { type: Array, required: true },
    isDragging: { type: Boolean, required: true }
  })
  const emits = defineEmits([
    'dragover',
    'drop',
    'dragenter',
    'dragleave',
    'fileSelect',
    'fileClick',
    'fileDelete'
  ])
  
  const fileInput = ref(null)
  
  function handleDragOver(event) {
    emits('dragover', event)
  }
  function handleFileDrop(event) {
    emits('drop', event)
  }
  function handleDragEnter(event) {
    emits('dragenter', event)
  }
  function handleDragLeave(event) {
    emits('dragleave', event)
  }
  function handleFileSelect(event) {
    emits('fileSelect', event)
  }
  function onFileClick(file) {
    emits('fileClick', file)
  }
  function handleFileDelete(fileId) {
    emits('fileDelete', fileId)
  }
  </script>