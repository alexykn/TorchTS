<template>
  <div class="model-status-indicator">
    <div class="status-dot" :class="dotClass"></div>
    <span class="status-label">Model {{ statusText }}</span>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTTSStore } from '../stores/ttsStore'
import { useAPI } from '../composables/useAPI'

const { get } = useAPI()
const ttsStore = useTTSStore()
const { isGenerating } = storeToRefs(ttsStore)

const modelStatus = ref({
  model_loaded: false,
  is_loading: false
})

const updateInterval = ref(null)
const fastUpdateInterval = ref(null)

const dotClass = computed(() => {
  if (modelStatus.value.is_loading) return 'loading'
  if (modelStatus.value.model_loaded) return 'loaded'
  return 'unloaded'
})

const statusText = computed(() => {
  if (modelStatus.value.is_loading) return 'Loading'
  if (modelStatus.value.model_loaded) return 'Loaded'
  return 'Unloaded'
})

async function fetchModelStatus() {
  try {
    const response = await get('/model/status')
    modelStatus.value = response
  } catch (error) {
    console.error('Failed to fetch model status:', error)
    // Keep current status on error
  }
}

function startSlowPolling() {
  if (updateInterval.value) clearInterval(updateInterval.value)
  updateInterval.value = setInterval(fetchModelStatus, 5000)
}

function startFastPolling() {
  if (fastUpdateInterval.value) clearInterval(fastUpdateInterval.value)
  fastUpdateInterval.value = setInterval(fetchModelStatus, 1000)
}

function stopFastPolling() {
  if (fastUpdateInterval.value) {
    clearInterval(fastUpdateInterval.value)
    fastUpdateInterval.value = null
  }
}

// Watch for generation state changes to adjust polling frequency
watch(isGenerating, (newValue) => {
  if (newValue) {
    // Start fast polling during generation
    startFastPolling()
  } else {
    // Stop fast polling and continue with slow polling
    stopFastPolling()
  }
})

onMounted(() => {
  fetchModelStatus()
  startSlowPolling()
})

onUnmounted(() => {
  if (updateInterval.value) {
    clearInterval(updateInterval.value)
  }
  if (fastUpdateInterval.value) {
    clearInterval(fastUpdateInterval.value)
  }
})
</script>

<style scoped>
.model-status-indicator {
  position: fixed;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  border-radius: 8px;
  padding: 4px 6px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.05);
  z-index: 1000;
  user-select: none;
  pointer-events: none;
  opacity: 0.8;
}

.status-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.loaded {
  background: #4CAF50;
  box-shadow: 0 0 4px rgba(76, 175, 80, 0.4);
}

.status-dot.loading {
  background: #FFC107;
  animation: pulse 1.2s ease-in-out infinite;
}

.status-dot.unloaded {
  background: #666;
}

.status-label {
  font-weight: 400;
  white-space: nowrap;
  opacity: 0.9;
}

@keyframes pulse {
  0%, 100% { 
    opacity: 1; 
    transform: scale(1);
  }
  50% { 
    opacity: 0.6; 
    transform: scale(0.9);
  }
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
  .model-status-indicator {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }
}
</style>