<template>
  <v-app :theme="isDark ? 'dark' : 'light'">
    <v-navigation-drawer
      permanent
      class="file-sidebar"
      width="300"
      elevation="1"
    >
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
              style="display: none"
              @change="handleFileSelect"
              aria-label="Choose a file to upload"
            >
            <div 
              class="upload-zone"
              :class="{ 'is-dragging': isDragging }"
              role="button"
              tabindex="0"
              aria-label="Click to choose a file or drag and drop here"
              @click="$refs.fileInput.click()"
              @keydown.enter="$refs.fileInput.click()"
              @keydown.space.prevent="$refs.fileInput.click()"
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
              @click="handleFileClick(file)"
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

      <div class="profile-section">
        <v-card flat class="pa-4">
          <v-card-text>
            <div class="d-flex align-center">
              <v-select
                v-model="selectedProfile"
                :items="profiles"
                item-title="name"
                item-value="id"
                label="Select Profile"
                density="compact"
                hide-details
                class="flex-grow-1"
                @update:model-value="handleProfileSelect"
              ></v-select>

              <v-menu v-if="selectedProfile">
                <template v-slot:activator="{ props }">
                  <v-btn
                    icon="mdi-cog"
                    variant="text"
                    size="small"
                    class="ml-2"
                    v-bind="props"
                  ></v-btn>
                </template>

                <v-list>
                  <v-list-item
                    @click="showDeleteFilesDialog = true"
                    prepend-icon="mdi-delete-sweep"
                  >
                    <v-list-item-title>Delete All Files</v-list-item-title>
                  </v-list-item>
                  <v-list-item
                    @click="showDeleteProfileDialog = true"
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
                    @click="createProfile"
                    :disabled="!newProfileName"
                  >
                    Create
                  </v-btn>
                  <v-btn
                    text
                    @click="showNewProfileDialog = false"
                  >
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
                  <v-btn
                    color="error"
                    text
                    @click="handleDeleteAllFiles"
                  >
                    Delete All
                  </v-btn>
                  <v-btn
                    text
                    @click="showDeleteFilesDialog = false"
                  >
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
                  <v-btn
                    color="error"
                    text
                    @click="handleDeleteProfile"
                  >
                    Delete Profile
                  </v-btn>
                  <v-btn
                    text
                    @click="showDeleteProfileDialog = false"
                  >
                    Cancel
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </v-card-text>
        </v-card>
      </div>
    </v-navigation-drawer>

    <v-main>
      <v-container>
        <v-card class="mx-auto" max-width="680" elevation="2">
          <v-card-title class="text-h5 font-weight-bold d-flex align-center justify-space-between">
            TorchTS
            <v-btn
              icon
              variant="text"
              class="theme-toggle"
              @click="toggleTheme"
            >
              <v-icon>{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
            </v-btn>
          </v-card-title>
          <v-card-text>
            <div class="input-group">
              <textarea 
                v-model="text" 
                class="macos-textarea"
                placeholder="Enter your text here..."
                @focus="focusedElement = 'textarea'"
                @blur="focusedElement = null"
              ></textarea>
            </div>

            <div class="grid-controls">
              <div class="input-group">
                <label class="input-label">Voice Preset</label>
                <select 
                  v-model="voice"
                  class="macos-select"
                  @focus="focusedElement = 'select'"
                  @blur="focusedElement = null"
                >
                  <option v-for="option in VOICE_OPTIONS" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>

              <div class="input-group">
                <label class="input-label">Volume</label>
                <div class="volume-slider">
                  <input 
                    type="range" 
                    v-model="volume"
                    class="macos-slider"
                    min="0"
                    max="100"
                    step="1"
                    @input="handleVolumeChange"
                  >
                </div>
              </div>
            </div>

            <button 
              v-if="isPlaying"
              class="macos-button primary"
              @click="togglePlayback"
            >
              <span>Pause</span>
            </button>
            <button 
              v-else-if="currentSource"
              class="macos-button primary"
              @click="togglePlayback"
            >
              <span>Play</span>
            </button>
            <button 
              v-else-if="!isGenerating"
              class="macos-button primary"
              @click="handleGenerateSpeech"
            >
              <span>Convert to Speech</span>
            </button>
            <div v-else class="loading-dots">
              <span>Generating</span>
              <div class="dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
              </div>
            </div>

            <div v-if="currentSource" class="button-group">
              <button 
                class="macos-button primary split-left"
                :class="{ disabled: !isDownloadComplete }"
                :disabled="!isDownloadComplete"
                @click="downloadAudio"
              >
                <v-icon>mdi-download</v-icon>
                Download
              </button>
              <div class="button-divider"></div>
              <button 
                class="macos-button primary split-right"
                @click="resetAll"
              >
                <v-icon>mdi-refresh</v-icon>
                Reset
              </button>
            </div>

            <transition name="fade">
              <div v-if="progressMessage" class="status-bar">
                <div class="status-icon">
                  <div class="status-dot" :class="{ processing: isGenerating }"></div>
                </div>
                <span v-if="!isDownloadComplete">{{ progressMessage }}</span>
                <div v-else class="playback-progress">
                  <input 
                    type="range" 
                    class="progress-slider"
                    :value="playbackProgress"
                    @input="handleSeek"
                    @change="handleSeek"
                    min="0"
                    max="100"
                    step="0.1"
                  >
                  <div class="progress-bar-container">
                    <div 
                      class="progress-bar-fill"
                      :style="{ width: `${playbackProgress}%` }"
                    ></div>
                    <div class="time-counter">
                      {{ formatTime(currentTime) }}/{{ formatTime(audioDuration) }}
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </v-card-text>
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useTTS } from './composables/useTTS'
import { useFileUpload } from './composables/useFileUpload'
import { useTheme } from './composables/useTheme'
import { useProfiles } from './composables/useProfile'
import { VOICE_OPTIONS, DEFAULT_VOICE, DEFAULT_VOLUME } from './constants/voices'
import { ACCEPTED_FILE_TYPES, SUPPORTED_FORMATS } from './constants/files'
import { API_ENDPOINTS } from './constants/api'
import './assets/global.css'

// State
const text = ref('')
const voice = ref(DEFAULT_VOICE)
const volume = ref(DEFAULT_VOLUME)
const focusedElement = ref(null)
const fileInput = ref(null)

// Composables
const { 
  isPlaying, 
  isGenerating, 
  progressMessage: ttsProgress,
  generateSpeech,
  togglePlayback: toggleTTS,
  reset: resetTTS,
  setVolume,
  currentSource,
  downloadProgress,
  currentChunkIndex,
  playbackProgress,
  isDownloadComplete,
  seekToPosition,
  downloadAudio,
  audioDuration,
  currentTime,
  stopGeneration,
  seekRelative,
} = useTTS()

const {
  uploadedFiles,
  progressMessage: fileProgress,
  isDragging,
  uploadFile,
  deleteFile,
  deleteAllFiles,
  clearFiles,
  setFiles
} = useFileUpload()

const {
  isDark,
  toggleTheme
} = useTheme()

const {
  profiles,
  currentProfile,
  loadProfiles,
  createProfile: createProfileAPI,
  selectProfile: selectProfileAPI,
  deleteProfile
} = useProfiles()

// Computed progress message (combines File and TTS progress)
const progressMessage = computed(() => ttsProgress.value || fileProgress.value)

// Add new profile-related state
const showNewProfileDialog = ref(false)
const newProfileName = ref('')
const newProfileVoice = ref(DEFAULT_VOICE)
const newProfileVolume = ref(DEFAULT_VOLUME)
const selectedProfile = ref(localStorage.getItem('selectedProfileId') ? parseInt(localStorage.getItem('selectedProfileId')) : null)

// Add new state for dialogs
const showDeleteFilesDialog = ref(false)
const showDeleteProfileDialog = ref(false)

// Methods
async function processFile(file) {
  if (file && selectedProfile.value) {
    try {
      const extractedText = await uploadFile(file, selectedProfile.value)
      if (extractedText) {
        text.value = extractedText
      }
    } catch (error) {
      // Error is already handled in useFileUpload
      if (fileInput.value) {
        fileInput.value.value = ''
      }
    }
  }
}

async function handleFileSelect(event) {
  const file = event.target.files[0]
  await processFile(file)
}

async function handleFileDrop(event) {
  const file = handleDrop(event)
  await processFile(file)
}

function handleDragEnter(event) {
  handleDragEnter(event)
}

function handleDragLeave(event) {
  handleDragLeave(event)
}

function handleDragOver(event) {
  handleDragOver(event)
}

function handleVolumeChange(event) {
  const newVolume = parseFloat(event.target.value) / 100  // Convert 0-100 to 0-1
  volume.value = parseInt(event.target.value)  // Keep the 0-100 value in the UI
  setVolume(newVolume)  // Send 0-1 value to audio
  // Update the volume slider fill
  event.target.style.setProperty('--volume-percentage', `${volume.value}%`)
}

async function handleGenerateSpeech() {
  await generateSpeech(text.value, voice.value)
}

function togglePlayback() {
  toggleTTS()
}

async function resetAll() {
  // Always attempt to stop generation unconditionally
  await stopGeneration()
  
  if (currentSource.value) {
    currentSource.value.onended = null  // Remove event listener
    currentSource.value.stop()
    currentSource.value.disconnect()
  }
  text.value = ''
  resetTTS()
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// Add time formatting function
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Update the handleSeek function
function handleSeek(event) {
  const position = parseFloat(event.target.value)
  if (!isNaN(position)) {
    seekToPosition(position)
  }
}

// Watch volume changes
watch(volume, (newValue) => {
  setVolume(newValue / 100)  // Convert to 0-1 range when setting volume
})

// Add this to the mounted hook
onMounted(() => {
  // Initialize volume slider fill
  const volumeSlider = document.querySelector('.macos-slider')
  if (volumeSlider) {
    volumeSlider.style.setProperty('--volume-percentage', `${volume.value}%`)
  }
})

// Load profiles on mount
onMounted(async () => {
  await loadProfiles()
  if (selectedProfile.value) {
    await handleProfileSelect(selectedProfile.value)
  }
})

// Profile management methods
async function createProfile() {
  try {
    const profile = await createProfileAPI(
      newProfileName.value,
      newProfileVoice.value,
      newProfileVolume.value / 100  // Convert to 0-1 range for API
    )
    selectedProfile.value = profile.id
    showNewProfileDialog.value = false
    newProfileName.value = ''
    newProfileVoice.value = DEFAULT_VOICE
    newProfileVolume.value = DEFAULT_VOLUME
  } catch (error) {
    console.error('Error creating profile:', error)
  }
}

async function handleProfileSelect(profileId) {
  if (profileId) {
    try {
      localStorage.setItem('selectedProfileId', profileId)
      const profileData = await selectProfileAPI(profileId)
      // Update voice and volume based on profile
      voice.value = profileData.profile.voice_preset || DEFAULT_VOICE
      volume.value = (profileData.profile.volume * 100) || DEFAULT_VOLUME  // Convert from 0-1 to 0-100
      // Set the files from the profile
      setFiles(profileData.files.map(f => ({
        ...f,
        name: f.filename, // Ensure filename is mapped to name for consistency
        type: f.file_type
      })))
    } catch (error) {
      console.error('Error selecting profile:', error)
    }
  }
}

async function handleFileDelete(fileId) {
  if (selectedProfile.value) {
    try {
      await deleteFile(selectedProfile.value, fileId)
    } catch (error) {
      console.error('Error deleting file:', error)
    }
  }
}

// Add click handler for files
async function handleFileClick(file) {
  if (!selectedProfile.value) return;
  
  try {
    const response = await fetch(API_ENDPOINTS.PROFILE_FILE(selectedProfile.value, file.id))
    if (!response.ok) {
      throw new Error('Failed to fetch file content')
    }
    const data = await response.json()
    if (data && data.content) {
      text.value = data.content
    }
  } catch (error) {
    console.error('Error loading file content:', error)
  }
}

// Add new methods for deletion
async function handleDeleteAllFiles() {
  if (!selectedProfile.value) return;
  
  try {
    await deleteAllFiles(selectedProfile.value)
    showDeleteFilesDialog.value = false
  } catch (error) {
    console.error('Error deleting files:', error)
  }
}

async function handleDeleteProfile() {
  if (!selectedProfile.value) return;
  
  try {
    await deleteProfile(selectedProfile.value)
    selectedProfile.value = null
    localStorage.removeItem('selectedProfileId')
    showDeleteProfileDialog.value = false
  } catch (error) {
    console.error('Error deleting profile:', error)
  }
}

// Add keyboard control handler
function handleKeydown(event) {
  // Only handle keyboard shortcuts if we're not in an input/textarea
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return
  }

  switch (event.code) {
    case 'Space':
      event.preventDefault()
      if (currentSource.value) {
        togglePlayback()
      }
      break
      
    case 'ArrowUp':
      event.preventDefault()
      const newVolumeUp = Math.min(100, volume.value + 5)
      volume.value = newVolumeUp
      setVolume(newVolumeUp / 100)
      break
      
    case 'ArrowDown':
      event.preventDefault()
      const newVolumeDown = Math.max(0, volume.value - 5)
      volume.value = newVolumeDown
      setVolume(newVolumeDown / 100)
      break
      
    case 'ArrowLeft':
      event.preventDefault()
      if (currentSource.value && isDownloadComplete.value) {
        seekRelative(-5) // Seek back 5 seconds
      }
      break
      
    case 'ArrowRight':
      event.preventDefault()
      if (currentSource.value && isDownloadComplete.value) {
        seekRelative(5) // Seek forward 5 seconds
      }
      break
  }
}

// Add event listeners on mount and clean up on unmount
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style>
:root {
  color-scheme: light dark;
}

.v-application {
  background: rgb(var(--v-theme-background)) !important;
}

.file-sidebar {
  border-right: 1px solid rgb(var(--v-theme-surface-variant));
  background: rgb(var(--v-theme-surface));
  position: relative;
}

.profile-section {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgb(var(--v-theme-surface));
}

.input-group {
  margin-bottom: 20px;
  width: 100%;
}

.input-label {
  display: block;
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 8px;
  font-weight: 500;
}

.macos-textarea {
  width: 100%;
  height: 360px;
  padding: 12px 16px;
  border: 1px solid rgb(var(--v-theme-surface-variant));
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  transition: all 0.2s ease;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  box-sizing: border-box;
}

.macos-textarea:focus {
  outline: none;
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.12);
}

.macos-select {
  width: 100%;
  height: 36px;
  padding: 8px 12px;
  border: 1px solid rgb(var(--v-theme-surface-variant));
  border-radius: 6px;
  font-size: 13px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 14px;
}

.macos-select:focus {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.12);
}

.grid-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin: 20px 0;
  align-items: end;
}

.volume-slider {
  display: flex;
  align-items: center;
  position: relative;
  height: 36px;
  width: 100%;
}

.macos-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 36px;
  background: rgb(var(--v-theme-surface-variant));
  border-radius: 6px;
  outline: none;
  margin: 0;
  padding: 0;
  cursor: pointer;
  position: relative;
}

.macos-slider::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: var(--volume-percentage);
  background: rgb(var(--v-theme-primary));
  border-radius: 6px;
  pointer-events: none;
}

.macos-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 36px;
  background: rgb(var(--v-theme-primary));
  border-radius: 0;
  cursor: pointer;
}

.macos-slider::-moz-range-thumb {
  width: 10px;
  height: 36px;
  background: rgb(var(--v-theme-primary));
  border: none;
  border-radius: 0;
  cursor: pointer;
}

.macos-slider::-webkit-slider-runnable-track {
  height: 36px;
  background: none;
}

.macos-slider::-moz-range-track {
  height: 36px;
  background: none;
}

.macos-button {
  width: 100%;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgb(var(--v-theme-primary));
  color: #ffffff;
}

.macos-button.secondary {
  background: rgb(var(--v-theme-secondary));
  margin-top: 12px;
}

.macos-button.secondary:hover {
  background: var(--border-color);
}

.playback-control {
  width: auto;
  padding: 8px 24px;
  margin: 12px auto;
  display: block;
}

.status-bar {
  margin-top: 20px;
  padding: 10px 16px;
  background: rgb(var(--v-theme-surface-variant));
  border-radius: 8px;
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface-variant));
  display: flex;
  align-items: center;
  overflow: hidden;
}

.status-icon {
  display: none;
}

.status-icon .status-dot {
  width: 8px;
  height: 8px;
  background: rgb(var(--v-theme-success));
  border-radius: 50%;
}

.status-icon .status-dot.processing {
  background: rgb(var(--v-theme-primary));
  animation: status-pulse 1.2s infinite;
}

@keyframes status-pulse {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.theme-toggle {
  transition: transform 0.3s ease;
}

.theme-toggle:hover {
  transform: rotate(15deg);
}

.button-group {
  display: flex;
  gap: 1px;
  margin-top: 20px;
  border-radius: 8px;
  overflow: hidden;
}

.button-divider {
  width: 1px;
  background: rgba(255, 255, 255, 0.1);
}

.macos-button.split-left {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  margin: 0;
}

.macos-button.split-right {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  margin: 0;
}

.loading-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgb(var(--v-theme-on-surface));
}

.dots {
  display: flex;
  gap: 4px;
}

.dot {
  width: 4px;
  height: 4px;
  background: currentColor;
  border-radius: 50%;
  animation: dot-pulse 1.4s infinite;
  opacity: 0.6;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dot-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.2); opacity: 1; }
}

.upload-zone {
  border: 2px dashed rgb(var(--v-theme-surface-variant));
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-zone:hover {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.05);
}

.upload-zone.is-dragging {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.file-info {
  background: rgb(var(--v-theme-surface-variant));
  transition: background 0.2s ease;
}

.file-info .v-card-text {
  padding: 12px;
}

.supported-formats {
  font-style: italic;
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.7;
  margin-top: 8px;
  text-align: center;
}

.progress-container {
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(var(--v-theme-on-surface-variant), 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: rgb(var(--v-theme-primary));
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  min-width: 40px;
  text-align: right;
}

.playback-progress {
  flex: 1;
  position: relative;
  height: 36px;
  margin: -10px -16px;
  display: flex;
  align-items: center;
}

.progress-slider {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
  margin: 0;
  padding: 0;
  -webkit-appearance: none;
  appearance: none;
}

.progress-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 36px;
  background: transparent;
  cursor: pointer;
}

.progress-slider::-moz-range-thumb {
  width: 20px;
  height: 36px;
  background: transparent;
  cursor: pointer;
  border: none;
}

.progress-bar-container {
  position: absolute;
  width: 100%;
  height: 100%;
  background: rgb(var(--v-theme-surface-variant));
  border-radius: 8px;
  overflow: hidden;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: rgb(var(--v-theme-primary));
  transition: width 0.1s linear;
  border-radius: 0;
}

.macos-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgb(var(--v-theme-surface-variant));
}

.macos-button.disabled:hover {
  background: rgb(var(--v-theme-surface-variant));
}

/* Add any new styles needed for profile management */
.v-dialog {
  border-radius: 8px;
}

.cursor-pointer {
  cursor: pointer;
}

.cursor-pointer:hover {
  background: rgba(var(--v-theme-primary), 0.05) !important;
}

.time-counter {
  position: relative;
  z-index: 2;
  color: rgb(var(--v-theme-on-surface));
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  pointer-events: none;
}
</style>