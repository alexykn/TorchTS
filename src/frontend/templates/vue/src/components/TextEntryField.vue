<template>
    <textarea 
      class="macos-textarea"
      :placeholder="computedPlaceholder"
      :value="modelValue"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
    ></textarea>
  </template>
  
  <script setup>
  import { computed } from 'vue'
  
  const props = defineProps({
    modelValue: {
      type: String,
      required: true
    },
    currentMode: {
      type: String,
      required: true
    }
  })
  
  const emit = defineEmits(['update:modelValue', 'focus', 'blur'])
  
  function onInput(event) {
    emit('update:modelValue', event.target.value)
  }
  
  function onFocus(event) {
    emit('focus', event)
  }
  
  function onBlur(event) {
    emit('blur', event)
  }
  
  const computedPlaceholder = computed(() => {
    if (props.currentMode === 'single') {
      return 'Enter your text here...'
    } else {
      return `Use speaker markers to assign text to different voices:
  
  >>> 1
  This text will be read by Speaker 1
  
  >>> 2
  This text will be read by Speaker 2
  
  Alternatively, you can use inline segments:
  
  >>> 1 Hello >>> 2 World >>> 3 ...and so on`
    }
  })
  </script>