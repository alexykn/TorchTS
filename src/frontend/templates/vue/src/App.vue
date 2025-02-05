<template>
  <v-app :theme="isDark ? 'dark' : 'light'">
    <Sidebar
      :uploadedFiles="uploadedFiles"
      :isDragging="isDragging"
      :selectedProfile="selectedProfile"
      :profiles="profiles"
      @dragover="handleDragOver"
      @drop="handleFileDrop"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @fileSelect="handleFileSelect"
      @fileClick="onFileClick"
      @fileDelete="handleFileDelete"
      @profileSelect="onProfileSelect"
      @profileCreate="onProfileCreate"
      @profileDelete="onProfileDelete"
      @deleteAllFiles="handleDeleteAllFiles"
    />
    <MainContent
      v-model:text="text"
      :currentMode="currentMode"
      :voice="voice"
      :volume="volume"
      :multiSpeakerVoices="multiSpeakerVoices"
      :isPlaying="isPlaying"
      :isGenerating="isGenerating"
      :currentSource="currentSource"
      :playbackProgress="playbackProgress"
      :isDownloadComplete="isDownloadComplete"
      :currentTime="currentTime"
      :audioDuration="audioDuration"
      :progressMessage="progressMessage"
      :isDark="isDark"
      @handleVolumeChange="handleVolumeChange"
      @generateSpeech="handleGenerateSpeech"
      @generateMultiSpeech="handleGenerateMultiSpeech"
      @togglePlayback="togglePlayback"
      @reset="handleReset"
      @downloadAudio="downloadAudio"
      @seek="handleSeek"
      @tabSwitch="onHandleTabSwitch"
      @toggleTheme="toggleTheme"
    />
    <ModeSwitchDialog 
      :showDialog="showTabSwitchDialog"
      @confirm="onConfirmTabSwitch"
      @cancel="onCancelTabSwitch"
      @update:showDialog="val => showTabSwitchDialog = val"
    />
  </v-app>
</template>

<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import Sidebar from './components/Sidebar.vue'
import MainContent from './components/MainContent.vue'
import ModeSwitchDialog from './components/ModeSwitchDialog.vue'

import { useTTS } from './composables/useTTS'
import { useFileUpload } from './composables/useFileUpload'
import { useTheme } from './composables/useTheme'
import { useProfiles } from './composables/useProfile'
import { usePlayback } from './composables/usePlayback'
import { useAudioContext } from './composables/useAudioContext'
import { VOICE_OPTIONS, DEFAULT_VOICE, DEFAULT_VOLUME } from './constants/voices'
import { ACCEPTED_FILE_TYPES, SUPPORTED_FORMATS } from './constants/files'
import './assets/global.css'
import './assets/components.css'
import './assets/layout.css'
import './assets/interactive.css'
import './assets/animations.css'
import { 
  resetAll, 
  formatTime, 
  handleTabSwitch, 
  confirmTabSwitch, 
  cancelTabSwitch, 
  handleKeydown as globalHandleKeydown 
} from './utils/generalHelpers'

// State
const text = ref('')
const originalFileContent = ref('')
const currentFileId = ref(null)
const voice = ref(DEFAULT_VOICE)
const focusedElement = ref(null)
const fileInput = ref(null)

// Composables
const { audioContext, gainNode } = useAudioContext()
const { volume, handleVolumeChange: handleVolumeChangeFromPlayback } = usePlayback(audioContext, gainNode)
const {
  isPlaying,
  isGenerating,
  progressMessage: ttsProgress,
  generateSpeech,
  generateMultiSpeech,
  togglePlayback: toggleTTS,
  reset: resetTTS,
  setVolume,
  currentSource,
  playbackProgress,
  isDownloadComplete,
  seekToPosition,
  downloadAudio,
  audioDuration,
  currentTime,
  stopGeneration,
  seekRelative,
  unifiedBuffer,
  setTotalDuration,
} = useTTS()
const {
  uploadedFiles,
  progressMessage: fileProgress,
  isDragging,
  deleteFile,
  deleteAllFiles,
  setFiles,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleFileSelect: handleFileSelectFromUpload,
  handleFileDrop: handleFileDropFromUpload,
  handleFileClick,
} = useFileUpload()
const { isDark, toggleTheme } = useTheme()
const { profiles, loadProfiles, createAndApplyProfile, applyProfile, removeProfile } = useProfiles()

// Computed progress message
const progressMessage = computed(() => ttsProgress.value || fileProgress.value)

// Profile state
const selectedProfile = ref(
  localStorage.getItem('selectedProfileId') ? parseInt(localStorage.getItem('selectedProfileId')) : null
)

// Mode selection state
const currentMode = ref('single')
const multiSpeakerVoices = ref({ 1: DEFAULT_VOICE, 2: DEFAULT_VOICE, 3: DEFAULT_VOICE, 4: DEFAULT_VOICE })

// Mode switch confirmation state
const showTabSwitchDialog = ref(false)
const pendingTabSwitch = ref(null)

// Add this watch effect after the state declarations
watch(text, (newValue) => {
  // If text is edited and differs from original file content, clear the file association
  if (currentFileId.value && newValue !== originalFileContent.value) {
    currentFileId.value = null
  }
}, { deep: true })

// --- PROFILE MANAGEMENT FUNCTIONS ---
async function onProfileSelect(profileId) {
  if (!profileId) return
  try {
    await applyProfile(profileId, {
      setVoice: (val) => { voice.value = val },
      setVolume: (val) => { volume.value = val },
      setFiles: (files) => { setFiles(files) }
    })
    selectedProfile.value = profileId
  } catch (error) {
    console.error('Error selecting profile:', error)
  }
}
async function onProfileCreate(data) {
  try {
    const profile = await createAndApplyProfile(
      data.name,
      data.voice,
      data.volume / 100,
      {
        setVoice: (val) => { voice.value = val },
        setVolume: (val) => { volume.value = val },
        setFiles: (files) => { setFiles(files) }
      }
    )
    selectedProfile.value = profile.id
  } catch (error) {
    console.error('Error creating profile:', error)
  }
}
async function onProfileDelete() {
  if (!selectedProfile.value) return
  try {
    await removeProfile(selectedProfile.value)
    selectedProfile.value = null
  } catch (error) {
    console.error('Error deleting profile:', error)
  }
}

// File Upload handlers
async function handleFileSelect(event) {
  await handleFileSelectFromUpload(
    event,
    selectedProfile.value,
    extractedText => { text.value = extractedText },
    () => { if (fileInput.value) { fileInput.value.value = '' } }
  )
}
async function handleFileDrop(event) {
  await handleFileDropFromUpload(
    event,
    selectedProfile.value,
    extractedText => { text.value = extractedText },
    () => { if (fileInput.value) { fileInput.value.value = '' } }
  )
}
function handleVolumeChange(event) {
  handleVolumeChangeFromPlayback(event, setVolume)
}
async function handleGenerateSpeech() {
  await generateSpeech(text.value, voice.value)
}
async function handleGenerateMultiSpeech() {
  await generateMultiSpeech(text.value, multiSpeakerVoices.value)
}
function togglePlayback() {
  toggleTTS()
}
async function handleReset() {
  await resetAll({
    text,
    fileInput,
    currentSource,
    resetTTS,
    stopGeneration
  });
}
function handleSeek(event) {
  const pos = parseFloat(event.target.value)
  if (!isNaN(pos)) { seekToPosition(pos) }
}

watch(volume, (newVal) => {
  setVolume(newVal / 100)
})
watch(unifiedBuffer, (newBuffer) => {
  if (newBuffer) {
    setTotalDuration(newBuffer.duration)
    audioDuration.value = newBuffer.duration
  }
})

onMounted(() => {
  const volumeSlider = document.querySelector('.macos-slider')
  if (volumeSlider) {
    volumeSlider.style.setProperty('--volume-percentage', `${volume.value}%`)
  }
})
onMounted(async () => {
  await loadProfiles()
  if (selectedProfile.value) {
    await onProfileSelect(selectedProfile.value)
  }
})

const keydownHandler = event => {
  globalHandleKeydown(event, { 
    currentSource, 
    togglePlayback, 
    volume, 
    setVolume, 
    isDownloadComplete, 
    seekRelative 
  });
}
onMounted(() => {
  window.addEventListener('keydown', keydownHandler)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', keydownHandler)
})

function onHandleTabSwitch(newMode) {
  handleTabSwitch({
    newMode,
    currentMode,
    isPlaying,
    isGenerating,
    resetTTS,
    text,
    pendingTabSwitch,
    showTabSwitchDialog
  });
}
function onConfirmTabSwitch() {
  // First stop any ongoing generation
  if (isGenerating.value) {
    stopGeneration()
  }
  
  confirmTabSwitch({
    resetTTS,
    text,
    currentMode,
    pendingTabSwitch,
    showTabSwitchDialog
  });
}
function onCancelTabSwitch() {
  cancelTabSwitch({
    pendingTabSwitch,
    showTabSwitchDialog
  });
}
function handleFileDelete(fileId) {
  if (!selectedProfile.value) return
  deleteFile(selectedProfile.value, fileId)
}
async function handleDeleteAllFiles() {
  if (!selectedProfile.value) return
  try {
    await deleteAllFiles(selectedProfile.value)
  } catch (error) {
    console.error('Error deleting all files:', error)
  }
}
async function onFileClick(file) {
  if (!selectedProfile.value) return
  try {
    await handleFileClick(selectedProfile.value, file, (content) => {
      text.value = content
      originalFileContent.value = content
      currentFileId.value = file.id
    })
  } catch (error) {
    console.error('Error handling file click:', error)
  }
}
</script>