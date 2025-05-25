<template>
  <v-main>
    <v-container>
      <v-card class="mx-auto" max-width="680" elevation="2">
        <v-card-title class="text-h5 font-weight-bold d-flex align-center justify-space-between">
          <div class="title-section">
            <ModeSwitchTabs :currentMode="currentMode" @tabSwitch="onHandleTabSwitch" />
          </div>
          <v-btn icon variant="text" class="theme-toggle" @click="$emit('toggleTheme')">
            <v-icon>{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text class="d-flex flex-column gap-4">
          <TextEntryField 
            v-model:modelValue="localText" 
            :currentMode="currentMode"
            @focus="() => focusedElement = 'textarea'"
            @blur="() => focusedElement = null"
          />
  
          <SpeakerSelection 
            :currentMode="currentMode"
            :voice="localVoice"
            :multiSpeakerVoices="localMultiSpeakerVoices"
            :voiceOptions="VOICE_OPTIONS"
            @update:voice="val => localVoice = val"
            @update-multi-speaker-voice="updateMultiSpeakerVoice"
          />

          <ModelStatus />
  
          <div class="controls-row">
            <AudioControls
              ref="audioControls"
              :volume="localVolume"
              @update:volume="onVolumeChange"
            />
  
            <PlaybackControls
              :currentMode="currentMode"
              :isPlaying="isPlaying"
              :isGenerating="isGenerating"
              :currentSource="currentSource"
              :playbackProgress="playbackProgress"
              :progressMessage="progressMessage"
              :isDownloadComplete="isDownloadComplete"
              :currentTime="currentTime"
              :audioDuration="audioDuration"
              @generateSpeech="handleGenerateSpeech"
              @generateMultiSpeech="handleGenerateMultiSpeech"
              @togglePlayback="togglePlayback"
              @seek="handleSeek"
            />
          </div>
  
          <div class="button-group">
            <button 
              class="macos-button primary split-left split-button"
              :class="{ disabled: !isDownloadComplete }"
              :disabled="!isDownloadComplete"
              @click="downloadAudio"
            >
              <v-icon>mdi-download</v-icon>
              Download
            </button>
            <div class="button-divider"></div>
            <button 
              class="macos-button primary split-right split-button"
              @click="handleReset"
            >
              <v-icon>mdi-refresh</v-icon>
              Reset
            </button>
          </div>
  
          <transition name="fade">
            <div v-if="progressMessage || isDownloadComplete" class="status-bar">
              <div class="status-icon">
                <div class="status-dot" :class="{ processing: isGenerating }"></div>
              </div>
              <div class="status-content" style="flex-grow: 1">
                <template v-if="progressMessage && !isDownloadComplete">
                  <span>{{ progressMessage }}</span>
                </template>
                <template v-else-if="isDownloadComplete">
                  <ProgressBar 
                    :playbackProgress="playbackProgress"
                    :currentTime="currentTime"
                    :audioDuration="audioDuration"
                    @seek="handleSeek"
                  />
                </template>
              </div>
            </div>
          </transition>
        </v-card-text>
      </v-card>
    </v-container>
  </v-main>
</template>
  
<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTTSStore } from '../stores/ttsStore'
import { useFileUploadStore } from '../stores/fileUploadStore'
import { VOICE_OPTIONS } from '../constants/voices'
  
// Import new components
import TextEntryField from './TextEntryField.vue'
import ModeSwitchTabs from './ModeSwitchTabs.vue'
import SpeakerSelection from './SpeakerSelection.vue'
import AudioControls from './AudioControls.vue'
import PlaybackControls from './PlaybackControls.vue'
import ProgressBar from './ProgressBar.vue'
import ModelStatus from './ModelStatus.vue'
  
// Define props and emits (as before)
const props = defineProps({
  currentMode: { type: String, required: true },
  text: { type: String, required: true },
  voice: { type: String, required: true },
  multiSpeakerVoices: { type: Object, required: true },
  isDark: { type: Boolean, required: true }
})
  
const emits = defineEmits([
  'update:text',
  'update:voice',
  'update:multiSpeakerVoices',
  'handleVolumeChange',
  'generateSpeech',
  'generateMultiSpeech',
  'togglePlayback',
  'reset',
  'downloadAudio',
  'seek',
  'tabSwitch',
  'toggleTheme'
])

const ttsStore = useTTSStore()
const fileUploadStore = useFileUploadStore()
const {
  isPlaying,
  isGenerating,
  currentSource,
  playbackProgress,
  isDownloadComplete,
  currentTime,
  audioDuration,
  progressMessage: ttsProgress,
  volume
} = storeToRefs(ttsStore)
const { progressMessage: fileProgress } = storeToRefs(fileUploadStore)

const progressMessage = computed(() => ttsProgress.value || fileProgress.value)
  
// Wrap "text" so that v-model works without writing directly to the prop.
const localText = computed({
  get: () => props.text,
  set: newValue => emits('update:text', newValue)
})
  
// Similarly, wrap "voice"
const localVoice = computed({
  get: () => props.voice,
  set: newValue => emits('update:voice', newValue)
})

const localVolume = computed({
  get: () => volume.value,
  set: newValue => { volume.value = newValue }
})
  
// For multiSpeakerVoices, we update via an event.
const localMultiSpeakerVoices = computed({
  get: () => props.multiSpeakerVoices,
  set: newValue => emits('update:multiSpeakerVoices', newValue)
})

const focusedElement = ref(null)
const audioControls = ref(null)

function onVolumeChange(val) {
  emits('handleVolumeChange', { target: { value: val } })
}
function handleGenerateSpeech() { 
  if (!localVoice.value) {
    console.error('No voice selected')
    return
  }
  emits('generateSpeech', { text: localText.value, voice: localVoice.value }) 
}
function handleGenerateMultiSpeech() { emits('generateMultiSpeech') }
function togglePlayback() { emits('togglePlayback') }
function handleReset() { emits('reset') }
function downloadAudio() { emits('downloadAudio') }
function handleSeek(event) { emits('seek', event) }
  
function updateMultiSpeakerVoice({ speaker, value }) {
  const updatedVoices = { ...localMultiSpeakerVoices.value, [speaker]: value }
  localMultiSpeakerVoices.value = updatedVoices
}
  
function onHandleTabSwitch(newMode) {
  emits('tabSwitch', newMode)
}

defineExpose({ audioControls })
</script>