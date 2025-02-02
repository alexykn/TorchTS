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
              Supported formats: {{ SUPPORTED_FORMATS }}
            </div>
          </div>
          
          <div v-if="uploadedFile" class="mt-4">
            <v-card variant="outlined" class="file-info">
              <v-card-text>
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <div class="text-subtitle-2">{{ uploadedFile.name }}</div>
                    <div class="text-caption">{{ uploadedFile.pages }} pages</div>
                  </div>
                  <v-btn
                    icon="mdi-close"
                    variant="text"
                    size="small"
                    @click="clearFile"
                  ></v-btn>
                </div>
              </v-card-text>
            </v-card>
          </div>
        </v-card-text>
      </v-card>
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
                    max="1"
                    step="0.1"
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
              v-else-if="currentSource && !isGenerating"
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

            <div v-if="currentSource && !isGenerating" class="button-group">
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
import { ref, watch, computed, onMounted } from 'vue'
import { useTTS } from './composables/useTTS'
import { useFileUpload } from './composables/useFileUpload'
import { useTheme } from './composables/useTheme'
import { VOICE_OPTIONS, DEFAULT_VOICE, DEFAULT_VOLUME } from './constants/voices'
import { ACCEPTED_FILE_TYPES, SUPPORTED_FORMATS } from './constants/files'
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
  downloadAudio
} = useTTS()

const {
  uploadedFile,
  progressMessage: fileProgress,
  isDragging,
  uploadFile,
  clearFile
} = useFileUpload()

const {
  isDark,
  toggleTheme
} = useTheme()

// Computed progress message (combines File and TTS progress)
const progressMessage = computed(() => ttsProgress.value || fileProgress.value)

// Methods
async function processFile(file) {
  if (file) {
    try {
      const extractedText = await uploadFile(file)
      text.value = extractedText
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
  const newVolume = parseFloat(event.target.value)
  volume.value = newVolume
  setVolume(newVolume)
  // Update the volume slider fill
  event.target.style.setProperty('--volume-percentage', `${newVolume * 100}%`)
}

async function handleGenerateSpeech() {
  await generateSpeech(text.value, voice.value)
}

function togglePlayback() {
  toggleTTS()
}

function resetAll() {
  text.value = ''
  resetTTS()
  clearFile()
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function handleSeek(event) {
  const position = parseFloat(event.target.value)
  if (!isNaN(position)) {
    seekToPosition(position)
  }
}

// Watch volume changes
watch(volume, (newValue) => {
  setVolume(newValue)
})

// Add this to the mounted hook
onMounted(() => {
  // Initialize volume slider fill
  const volumeSlider = document.querySelector('.macos-slider')
  if (volumeSlider) {
    volumeSlider.style.setProperty('--volume-percentage', `${volume.value * 100}%`)
  }
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
  width: 2px;
  height: 36px;
  background: rgb(var(--v-theme-primary));
  border-radius: 0;
  cursor: pointer;
}

.macos-slider::-moz-range-thumb {
  width: 2px;
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
  text-align: left;
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
</style>