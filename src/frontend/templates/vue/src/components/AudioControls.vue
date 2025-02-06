<template>
  <div class="volume-control">
    <div class="volume-slider">
      <input 
        type="range" 
        class="macos-slider"
        :value="volume"
        min="0"
        max="100"
        step="1"
        @input="onVolumeInput"
      >
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  volume: {
    type: Number,
    required: true
  }
})
const emit = defineEmits(['update:volume'])
function onVolumeInput(event) {
  const newValue = Number(event.target.value)
  emit('update:volume', newValue)
}
</script>