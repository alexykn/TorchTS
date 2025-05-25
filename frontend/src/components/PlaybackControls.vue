<template>
    <div class="playback-controls">
      <!-- Conversion / play-pause controls -->
      <div v-if="currentMode === 'single'" class="conversion-controls">
        <button 
          v-if="isPlaying" 
          class="macos-button primary" 
          @click="onTogglePlayback"
        >
          <span>Pause</span>
        </button>
        <button 
          v-else-if="currentSource || isDownloadComplete" 
          class="macos-button primary" 
          @click="onTogglePlayback"
        >
          <span>Play</span>
        </button>
        <button 
          v-else-if="!isGenerating" 
          class="macos-button primary" 
          @click="onGenerateSpeech"
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
  
      <div v-else-if="currentMode === 'multi'" class="conversion-controls">
        <button 
          v-if="!isGenerating && !currentSource" 
          class="macos-button primary" 
          @click="onGenerateMultiSpeech"
        >
          Convert to Speech
        </button>
        <button 
          v-else-if="isPlaying" 
          class="macos-button primary" 
          @click="onTogglePlayback"
        >
          Pause
        </button>
        <button 
          v-else-if="currentSource || isDownloadComplete" 
          class="macos-button primary" 
          @click="onTogglePlayback"
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
  </template>
  
  <script setup>
  import { computed } from 'vue'
  import { formatTime } from '../utils/generalHelpers'
  import ProgressBar from './ProgressBar.vue'
  
  const props = defineProps({
    currentMode: {
      type: String,
      required: true
    },
    isPlaying: {
      type: Boolean,
      required: true
    },
    isGenerating: {
      type: Boolean,
      required: true
    },
    currentSource: {
      type: Object,
      default: null
    },
    playbackProgress: {
      type: Number,
      required: true
    },
    progressMessage: {
      type: String,
      required: false
    },
    isDownloadComplete: {
      type: Boolean,
      required: true
    },
    currentTime: {
      type: Number,
      required: true
    },
    audioDuration: {
      type: Number,
      required: true
    }
  })
  const emit = defineEmits([
    'generateSpeech',
    'generateMultiSpeech',
    'togglePlayback',
    'seek',
    'download',
    'reset'
  ])
  
  function onGenerateSpeech() {
    emit('generateSpeech')
  }
  
  function onGenerateMultiSpeech() {
    emit('generateMultiSpeech')
  }
  
  function onTogglePlayback() {
    emit('togglePlayback')
  }
  
  function onSeek(event) {
    emit('seek', event)
  }
  
  function onDownload() {
    emit('download')
  }
  
  function onReset() {
    emit('reset')
  }
  
  const formattedCurrentTime = computed(() => formatTime(props.currentTime))
  const formattedAudioDuration = computed(() => formatTime(props.audioDuration))
  </script>