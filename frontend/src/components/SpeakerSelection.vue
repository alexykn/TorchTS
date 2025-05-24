<template>
    <div>
      <!-- Single Speaker Mode -->
      <div v-if="currentMode === 'single'" class="voice-selection-group">
        <!-- Pipeline Selection -->
        <div class="input-group voice-group">
          <label class="input-label mb-3 mt-3">Language</label>
          <select 
            class="macos-select"
            :value="selectedPipeline"
            @change="onPipelineChange"
          >
            <option 
              v-for="option in PIPELINE_OPTIONS" 
              :key="option.value" 
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>

        <!-- Voice Selection -->
        <div class="input-group voice-group">
          <label class="input-label mb-3 mt-3">Voice</label>
          <select 
            class="macos-select"
            :value="voice"
            @change="onSingleVoiceChange"
          >
            <option 
              v-for="option in filteredVoiceOptions" 
              :key="option.value" 
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>
      <!-- Multi Speaker Mode -->
      <div v-else class="grid-controls">
        <div class="speaker-grid">
          <div 
            class="input-group" 
            v-for="n in speakerCount" 
            :key="n"
          >
            <label class="input-label">Speaker {{ n }}</label>
            <select 
              class="macos-select"
              :value="multiSpeakerVoices[n]"
              @change="onMultiVoiceChange(n, $event.target.value)"
            >
              <option 
                v-for="option in voiceOptions" 
                :key="option.value" 
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, watch } from 'vue'
  import { PIPELINE_OPTIONS, VOICES_BY_PIPELINE } from '../constants/voices'

  const props = defineProps({
    currentMode: {
      type: String,
      required: true
    },
    // For single‑speaker mode
    voice: {
      type: String,
      required: false
    },
    // For multi‑speaker mode
    multiSpeakerVoices: {
      type: Object,
      required: false,
      default: () => ({})
    },
    voiceOptions: {
      type: Array,
      required: true
    },
    speakerCount: {
      type: Number,
      default: 4
    }
  })
  const emit = defineEmits(['update:voice', 'update-multi-speaker-voice'])
  
  // Get pipeline from voice ID (e.g., 'am_michael' → 'american')
  const getPipelineFromVoice = (voiceId) => {
    for (const [pipeline, voices] of Object.entries(VOICES_BY_PIPELINE)) {
      if (voices.some(v => v.value === voiceId)) {
        return pipeline
      }
    }
    return 'american' // fallback
  }

  // Update selectedPipeline when voice prop changes
  const selectedPipeline = ref(getPipelineFromVoice(props.voice))
  watch(() => props.voice, (newVoice) => {
    selectedPipeline.value = getPipelineFromVoice(newVoice)
  })

  const filteredVoiceOptions = computed(() => {
    return VOICES_BY_PIPELINE[selectedPipeline.value] || []
  })

  function onPipelineChange(event) {
    selectedPipeline.value = event.target.value
    // Select first voice from new pipeline
    const firstVoice = VOICES_BY_PIPELINE[event.target.value][0]
    if (firstVoice) {
      emit('update:voice', firstVoice.value)
    }
  }

  function onSingleVoiceChange(event) {
    emit('update:voice', event.target.value)
  }
  
  function onMultiVoiceChange(speaker, value) {
    emit('update-multi-speaker-voice', { speaker, value })
  }
  </script>

  <style scoped>
  .voice-selection-group {
    display: flex;
    gap: 1rem;
  }

  .voice-group {
    flex: 1;
  }
  </style>