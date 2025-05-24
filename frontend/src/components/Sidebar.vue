<template>
  <v-navigation-drawer permanent class="file-sidebar" width="300" elevation="1">
    <FileUpload
      @fileSelect="handleFileSelect"
      @fileClick="onFileClick"
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
  import { useProfiles } from '../composables/useProfile'

  const { profiles, selectedProfile } = useProfiles()

  const emits = defineEmits([
    'fileSelect',
    'fileClick',
    'profileSelect',
    'profileCreate',
    'profileDelete',
    'deleteAllFiles'
  ])

  function handleFileSelect(content) { emits('fileSelect', content) }
  function onFileClick(fileInfo) { emits('fileClick', fileInfo) }
  function onProfileSelect(profileId) { emits('profileSelect', profileId) }
  function onProfileCreate(data) { emits('profileCreate', data) }
  function onProfileDelete() { emits('profileDelete') }
  function handleDeleteAllFiles() { emits('deleteAllFiles') }
  </script>