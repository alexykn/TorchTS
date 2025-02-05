<template>
    <v-dialog v-model="localShowDialog" max-width="400px">
      <v-card>
        <v-card-title>Switch Mode Confirmation</v-card-title>
        <v-card-text>
          Audio is currently playing or being generated. Switching modes will stop playback
          and clear your session. Do you wish to proceed?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" text @click="onConfirm">OK</v-btn>
          <v-btn text @click="onCancel">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </template>
  
  <script setup>
  import { computed } from 'vue'

  const props = defineProps({
    showDialog: { type: Boolean, required: true }
  })
  const emits = defineEmits(['update:showDialog', 'confirm', 'cancel'])
  
  const localShowDialog = computed({
    get: () => props.showDialog,
    set: (val) => emits('update:showDialog', val)
  })
  
  function onConfirm() {
    emits('confirm')
  }
  function onCancel() {
    emits('cancel')
  }
  </script>