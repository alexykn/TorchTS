<template>
  <div class="playback-progress" style="flex-grow: 1;">
    <input 
      type="range" 
      class="progress-slider"
      :value="playbackProgress"
      @input="onSeek"
      @change="onSeek"
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
        {{ formattedCurrentTime }}/{{ formattedAudioDuration }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatTime } from '../utils/generalHelpers'

const props = defineProps({
  playbackProgress: {
    type: Number,
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

const emit = defineEmits(['seek'])

const formattedCurrentTime = computed(() => formatTime(props.currentTime))
const formattedAudioDuration = computed(() => formatTime(props.audioDuration))

function onSeek(event) {
  emit('seek', event)
}
</script>