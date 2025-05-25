export async function resetAll({ text, fileInput, currentSource, resetTTS, stopGeneration }) {
  // Always attempt to stop generation unconditionally
  await stopGeneration();

  if (currentSource.value) {
    currentSource.value.onended = null; // Remove event listener
    try {
      currentSource.value.stop();
    } catch (e) {
      // Ignore error if source was never started
      console.warn('Could not stop audio source (may not have been started):', e.message);
    }
    currentSource.value.disconnect();
  }
  
  text.value = '';
  await resetTTS();
  
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}

export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// --- New tab switch helper functions ---

export function handleTabSwitch({ newMode, currentMode, isPlaying, isGenerating, resetTTS, text, pendingTabSwitch, showTabSwitchDialog }) {
  if (newMode === currentMode.value) return;
  if (isPlaying.value || isGenerating.value) {
    pendingTabSwitch.value = newMode;
    showTabSwitchDialog.value = true;
  } else {
    resetTTS();
    text.value = '';
    currentMode.value = newMode;
  }
}

export function confirmTabSwitch({ resetTTS, text, currentMode, pendingTabSwitch, showTabSwitchDialog }) {
  // First stop any ongoing generation and reset
  resetTTS();
  text.value = '';
  currentMode.value = pendingTabSwitch.value;
  pendingTabSwitch.value = null;
  showTabSwitchDialog.value = false;
}

export function cancelTabSwitch({ pendingTabSwitch, showTabSwitchDialog }) {
  pendingTabSwitch.value = null;
  showTabSwitchDialog.value = false;
}

// --- New keydown handler helper function ---

export function handleKeydown(event, { currentSource, togglePlayback, volume, applyVolume, seekRelative }) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

  switch (event.code) {
    case 'Space':
      event.preventDefault();
      if (currentSource.value) { 
        togglePlayback(); 
      }
      break;
    case 'ArrowUp':
      event.preventDefault();
      const newVolUp = Math.min(100, volume.value + 5);
      if (applyVolume) {
        applyVolume(newVolUp);
      } else {
        volume.value = newVolUp;
      }
      break;
    case 'ArrowDown':
      event.preventDefault();
      const newVolDown = Math.max(0, volume.value - 5);
      if (applyVolume) {
        applyVolume(newVolDown);
      } else {
        volume.value = newVolDown;
      }
      break;
    case 'ArrowLeft':
      event.preventDefault();
      if (currentSource.value) {
        seekRelative(-5);
      }
      break;
    case 'ArrowRight':
      event.preventDefault();
      if (currentSource.value) {
        seekRelative(5);
      }
      break;
  }
}
