<template>
    <v-navigation-drawer permanent class="file-sidebar" width="300" elevation="1">
      <FileUpload
        :uploadedFiles="uploadedFiles"
        :isDragging="isDragging"
        @dragover="handleDragOver"
        @drop="handleFileDrop"
        @dragenter="handleDragEnter"
        @dragleave="handleDragLeave"
        @fileSelect="handleFileSelect"
        @fileClick="onFileClick"
        @fileDelete="handleFileDelete"
      />
      <ProfileManagement
        :selectedProfile="selectedProfile"
        :profiles="profiles"
        @profileSelect="onProfileSelect"
        @profileCreate="onProfileCreate"
        @profileDelete="onProfileDelete"
        @deleteAllFiles="handleDeleteAllFiles"
      />
    </v-navigation-drawer>
  </template>
  
  <script setup>
  import FileUpload from './FileUpload.vue'
  import ProfileManagement from './ProfileManagement.vue'
  
  const props = defineProps({
    uploadedFiles: { type: Array, required: true },
    isDragging: { type: Boolean, required: true },
    selectedProfile: { type: [Number, null], default: null },
    profiles: { type: Array, required: true }
  })
  const emits = defineEmits([
    'dragover',
    'drop',
    'dragenter',
    'dragleave',
    'fileSelect',
    'fileClick',
    'fileDelete',
    'profileSelect',
    'profileCreate',
    'profileDelete',
    'deleteAllFiles'
  ])
  
  function handleDragOver(event) { emits('dragover', event) }
  function handleFileDrop(event) { emits('drop', event) }
  function handleDragEnter(event) { emits('dragenter', event) }
  function handleDragLeave(event) { emits('dragleave', event) }
  function handleFileSelect(event) { emits('fileSelect', event) }
  function onFileClick(file) { emits('fileClick', file) }
  function handleFileDelete(fileId) { emits('fileDelete', fileId) }
  function onProfileSelect(profileId) { emits('profileSelect', profileId) }
  function onProfileCreate(data) { emits('profileCreate', data) }
  function onProfileDelete() { emits('profileDelete') }
  function handleDeleteAllFiles() { emits('deleteAllFiles') }
  </script>