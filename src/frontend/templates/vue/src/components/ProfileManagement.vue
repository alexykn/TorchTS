<template>
    <div class="profile-section">
      <v-card flat class="pa-4">
        <v-card-text>
          <div class="d-flex align-center">
            <v-select
              v-model="localSelectedProfile"
              :items="profiles"
              item-title="name"
              item-value="id"
              label="Select Profile"
              density="compact"
              hide-details
              class="flex-grow-1"
              @update:model-value="onProfileSelect"
            ></v-select>
  
            <v-menu v-if="localSelectedProfile">
              <template v-slot:activator="{ props }">
                <v-btn
                  icon
                  variant="text"
                  size="small"
                  class="ml-2"
                  v-bind="props"
                ></v-btn>
              </template>
  
              <v-list>
                <v-list-item
                  @click="() => showDeleteFilesDialog = true"
                  prepend-icon="mdi-delete-sweep"
                >
                  <v-list-item-title>Delete All Files</v-list-item-title>
                </v-list-item>
                <v-list-item
                  @click="() => showDeleteProfileDialog = true"
                  prepend-icon="mdi-account-remove"
                  color="error"
                >
                  <v-list-item-title>Delete Profile</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
          
          <v-dialog v-model="showNewProfileDialog" max-width="400px">
            <template v-slot:activator="{ props }">
              <v-btn
                block
                color="primary"
                class="mt-2"
                v-bind="props"
              >
                Create New Profile
              </v-btn>
            </template>
            
            <v-card>
              <v-card-title>New Profile</v-card-title>
              <v-card-text>
                <v-text-field
                  v-model="newProfileName"
                  label="Profile Name"
                  required
                ></v-text-field>
                <v-select
                  v-model="newProfileVoice"
                  :items="VOICE_OPTIONS"
                  label="Default Voice"
                  item-title="label"
                  item-value="value"
                ></v-select>
                <v-slider
                  v-model="newProfileVolume"
                  label="Default Volume"
                  min="0"
                  max="100"
                  step="1"
                  thumb-label
                ></v-slider>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn
                  color="primary"
                  text
                  @click="onProfileCreate"
                  :disabled="!newProfileName"
                >
                  Create
                </v-btn>
                <v-btn text @click="() => showNewProfileDialog = false">
                  Cancel
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
  
          <!-- Delete Files Confirmation Dialog -->
          <v-dialog v-model="showDeleteFilesDialog" max-width="400px">
            <v-card>
              <v-card-title>Delete All Files</v-card-title>
              <v-card-text>
                Are you sure you want to delete all files from this profile? This action cannot be undone.
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="error" text @click="onDeleteAllFiles">
                  Delete All
                </v-btn>
                <v-btn text @click="() => showDeleteFilesDialog = false">
                  Cancel
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
  
          <!-- Delete Profile Confirmation Dialog -->
          <v-dialog v-model="showDeleteProfileDialog" max-width="400px">
            <v-card>
              <v-card-title>Delete Profile</v-card-title>
              <v-card-text>
                Are you sure you want to delete this profile? All associated files will be permanently deleted. This action cannot be undone.
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="error" text @click="onProfileDelete">
                  Delete Profile
                </v-btn>
                <v-btn text @click="() => showDeleteProfileDialog = false">
                  Cancel
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </v-card-text>
      </v-card>
    </div>
  </template>
  
  <script setup>
  import { ref, watch } from 'vue'
  import { VOICE_OPTIONS, DEFAULT_VOICE, DEFAULT_VOLUME } from '../constants/voices'
  
  const props = defineProps({
    selectedProfile: { type: [Number, null], default: null },
    profiles: { type: Array, required: true }
  })
  const emits = defineEmits([
    'update:selectedProfile',
    'profileSelect',
    'profileCreate',
    'profileDelete',
    'deleteAllFiles'
  ])
  
  const localSelectedProfile = ref(props.selectedProfile)
  watch(() => props.selectedProfile, (newVal) => {
    localSelectedProfile.value = newVal
  })
  
  const showNewProfileDialog = ref(false)
  const newProfileName = ref('')
  const newProfileVoice = ref(DEFAULT_VOICE)
  const newProfileVolume = ref(DEFAULT_VOLUME)
  const showDeleteFilesDialog = ref(false)
  const showDeleteProfileDialog = ref(false)
  
  function onProfileSelect(profileId) {
    emits('profileSelect', profileId)
  }
  function onProfileCreate() {
    emits('profileCreate', {
      name: newProfileName.value,
      voice: newProfileVoice.value,
      volume: newProfileVolume.value
    })
    showNewProfileDialog.value = false
    newProfileName.value = ''
    newProfileVoice.value = DEFAULT_VOICE
    newProfileVolume.value = DEFAULT_VOLUME
  }
  function onProfileDelete() {
    emits('profileDelete')
  }
  function onDeleteAllFiles() {
    emits('deleteAllFiles')
    showDeleteFilesDialog.value = false
  }
  </script>