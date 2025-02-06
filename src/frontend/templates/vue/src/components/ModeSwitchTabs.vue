<template>
    <div class="title-section">
      <div>
        TorchTS
        <div class="mode-tabs">
          <button 
            class="tab-button"
            :class="{ active: currentMode === 'single' }"
            @click="switchMode('single')"
          >
            Single Speaker
          </button>
          <button 
            class="tab-button"
            :class="{ active: currentMode === 'multi' }"
            @click="switchMode('multi')"
          >
            Multi Speaker
          </button>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  const props = defineProps({
    currentMode: {
      type: String,
      required: true
    }
  })
  const emit = defineEmits(['tabSwitch'])
  
  function switchMode(mode) {
    emit('tabSwitch', mode)
  }
  </script>s