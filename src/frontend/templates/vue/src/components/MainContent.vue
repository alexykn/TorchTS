<template>
    <v-main>
      <v-container>
        <v-card class="mx-auto" max-width="680" elevation="2">
          <v-card-title class="text-h5 font-weight-bold d-flex align-center justify-space-between">
            <div class="title-section">
              TorchTS
              <div class="mode-tabs">
                <button 
                  class="tab-button"
                  :class="{ active: currentMode === 'single' }"
                  @click="onHandleTabSwitch('single')"
                >
                  Single Speaker
                </button>
                <button 
                  class="tab-button"
                  :class="{ active: currentMode === 'multi' }"
                  @click="onHandleTabSwitch('multi')"
                >
                  Multi Speaker
                </button>
              </div>
            </div>
            <v-btn icon variant="text" class="theme-toggle" @click="$emit('toggleTheme')">
              <v-icon>{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
            </v-btn>
          </v-card-title>
          <v-card-text>
            <div class="input-group">
              <!-- Two-way binding for text via computed "localText" -->
              <textarea 
                v-model="localText" 
                class="macos-textarea"
                :placeholder="currentMode === 'single' 
                  ? 'Enter your text here...' 
                  : `Use speaker markers to assign text to different voices:
  
  >>> 1
  This text will be read by Speaker 1
  
  >>> 2
  This text will be read by Speaker 2
  
  Alternatively, you can use inline segments:
  
  >>> 1 Hello >>> 2 World >>> 3 ...and so on`"
                @focus="() => focusedElement = 'textarea'"
                @blur="() => focusedElement = null"
              ></textarea>
            </div>
  
            <!-- Single Speaker Mode -->
            <div v-if="currentMode === 'single'" class="single-controls">
              <div class="input-group voice-group">
                <label class="input-label">Voice Preset</label>
                <!-- Wrap voice prop with computed "localVoice" -->
                <select 
                  v-model="localVoice"
                  class="macos-select"
                  @focus="() => focusedElement = 'select'"
                  @blur="() => focusedElement = null"
                >
                  <option v-for="option in VOICE_OPTIONS" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>
  
              <div class="input-group volume-group">
                <label class="input-label">Volume</label>
                <div class="volume-slider">
                  <!-- Wrap volume prop with computed "localVolume" -->
                  <input 
                    type="range" 
                    v-model="localVolume"
                    class="macos-slider"
                    min="0"
                    max="100"
                    step="1"
                    @input="handleVolumeChange"
                  >
                </div>
              </div>
            </div>
  
            <!-- Multi Speaker Mode -->
            <div v-else class="grid-controls">
              <div class="speaker-grid">
                <div class="input-group" v-for="n in 4" :key="n">
                  <label class="input-label">Speaker {{ n }}</label>
                  <!-- Instead of v-model on an object property, bind the value and update on change -->
                  <select 
                    :value="localMultiSpeakerVoices[n]"
                    @change="updateMultiSpeakerVoice(n, $event.target.value)"
                    class="macos-select"
                  >
                    <option v-for="option in VOICE_OPTIONS" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
              </div>
  
              <div class="multi-controls-row">
                <div class="volume-control">
                  <label class="input-label">Volume</label>
                  <div class="volume-slider">
                    <input 
                      type="range" 
                      v-model="localVolume"
                      class="macos-slider"
                      min="0"
                      max="100"
                      step="1"
                      @input="handleVolumeChange"
                    >
                  </div>
                </div>
  
                <div class="convert-button-wrapper">
                  <button 
                    v-if="!isGenerating && !currentSource"
                    class="macos-button primary"
                    @click="handleGenerateMultiSpeech"
                  >
                    Convert to Speech
                  </button>
                  <button 
                    v-else-if="isPlaying"
                    class="macos-button primary"
                    @click="togglePlayback"
                  >
                    Pause
                  </button>
                  <button 
                    v-else-if="currentSource"
                    class="macos-button primary"
                    @click="togglePlayback"
                  >
                    Play
                  </button>
                  <div v-else class="loading-dots">
                    <span>Generating</span>
                    <div class="dots">
                      <div class="dot"></div>
                      <div class="dot"></div>
                      <div class="dot"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
  
            <!-- Common Controls for Single Speaker Mode -->
            <div v-if="currentMode === 'single'">
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
              <div v-else-if="isGenerating" class="loading-dots">
                <span>Generating</span>
                <div class="dots">
                  <div class="dot"></div>
                  <div class="dot"></div>
                  <div class="dot"></div>
                </div>
              </div>
            </div>
  
            <!-- Button Group (Download/Reset) -->
            <div class="button-group">
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
                @click="handleReset"
              >
                <v-icon>mdi-refresh</v-icon>
                Reset
              </button>
            </div>
  
            <!-- Progress Message -->
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
  </template>
  
  <script setup>
  import { computed, ref } from 'vue'
  import { formatTime } from '../utils/generalHelpers'
  import { VOICE_OPTIONS } from '../constants/voices'
  
  const props = defineProps({
    currentMode: { type: String, required: true },
    text: { type: String, required: true },
    voice: { type: String, required: true },
    volume: { type: Number, required: true },
    multiSpeakerVoices: { type: Object, required: true },
    isPlaying: { type: Boolean, required: true },
    isGenerating: { type: Boolean, required: true },
    currentSource: { type: [Object, null], default: null },
    playbackProgress: { type: Number, required: true },
    isDownloadComplete: { type: Boolean, required: true },
    currentTime: { type: Number, required: true },
    audioDuration: { type: Number, required: true },
    progressMessage: { type: String, required: false },
    isDark: { type: Boolean, required: true }
  })
  
  const emits = defineEmits([
    'update:text',
    'update:voice',
    'update:volume',
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
  
  // Wrap "text" so that v-model works without writing directly to the prop.
  const localText = computed({
    get: () => props.text,
    set: newValue => emits('update:text', newValue)
  })
  
  // Similarly, wrap "voice" and "volume"
  const localVoice = computed({
    get: () => props.voice,
    set: newValue => emits('update:voice', newValue)
  })
  const localVolume = computed({
    get: () => props.volume,
    set: newValue => emits('update:volume', newValue)
  })
  
  // For multiSpeakerVoices, we create a computed getter/setter. Since it is an object,
  // we update it via a method rather than relying on direct mutation.
  const localMultiSpeakerVoices = computed({
    get: () => props.multiSpeakerVoices,
    set: newValue => emits('update:multiSpeakerVoices', newValue)
  })
  
  const focusedElement = ref(null)
  
  function handleVolumeChange(event) {
    emits('handleVolumeChange', event)
  }
  function handleGenerateSpeech() { emits('generateSpeech') }
  function handleGenerateMultiSpeech() { emits('generateMultiSpeech') }
  function togglePlayback() { emits('togglePlayback') }
  function handleReset() { emits('reset') }
  function downloadAudio() { emits('downloadAudio') }
  function handleSeek(event) { emits('seek', event) }
  function onHandleTabSwitch(mode) { emits('tabSwitch', mode) }
  
  function updateMultiSpeakerVoice(index, newValue) {
    const updatedVoices = { ...localMultiSpeakerVoices.value, [index]: newValue }
    localMultiSpeakerVoices.value = updatedVoices
  }
  </script>