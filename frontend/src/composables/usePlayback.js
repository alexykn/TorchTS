import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTTSStore } from '../stores/ttsStore'

export function usePlayback(audioContext, gainNode) {
  const ttsStore = useTTSStore()
  const {
    volume,
    isPlaying,
    currentSource, // This is ttsStore.currentSource
    playbackProgress,
    currentTime,
    audioDuration
  } = storeToRefs(ttsStore)
  const {
    setVolumeAndApply,
    setIsPlaying,
    setCurrentSource, // Action to update ttsStore.currentSource
    setPlaybackProgress,
    setCurrentTime
  } = ttsStore
  
  // startTime is used to calculate elapsed time for Web Audio
  const startTime = ref(0) 
  // pausedTime stores the playback position when Web Audio is paused
  const pausedTime = ref(0) 
  // totalDuration is the duration of the entire audio, crucial for progress calculation
  const totalDuration = ref(0) 
  
  const htmlAudio = ref(null)
  const isUsingHtmlAudio = ref(false)
  const audioBlob = ref(null)

  function updatePlaybackProgress() {
    if (!isPlaying.value) return;

    if (isUsingHtmlAudio.value && htmlAudio.value && htmlAudio.value.readyState >= 2) { // Check if metadata is loaded
      const currentHtmlTime = htmlAudio.value.currentTime;
      const htmlDuration = htmlAudio.value.duration;
      
      setCurrentTime(currentHtmlTime);
      if (htmlDuration > 0) {
        const progress = (currentHtmlTime / htmlDuration) * 100;
        setPlaybackProgress(progress);
        // console.log(`🎵 HTML5 Progress: Time ${currentHtmlTime.toFixed(2)}s / ${htmlDuration.toFixed(2)}s = ${progress.toFixed(1)}%`);
      }
    } else if (audioContext.value && currentSource.value && !isUsingHtmlAudio.value) { // Ensure Web Audio is active
      // For Web Audio, elapsed time is context's current time minus the time playback started.
      // startTime.value MUST be correctly set to the audioContext.currentTime when playback of a segment/buffer began,
      // OR it must be adjusted by cumulative prior durations if playing a stream of chunks.
      const elapsed = audioContext.value.currentTime - startTime.value;
      
      if (totalDuration.value > 0) {
        // Clamp elapsed time to be within 0 and totalDuration
        const clampedElapsed = Math.max(0, Math.min(totalDuration.value, elapsed));
        setCurrentTime(clampedElapsed);
        const progress = Math.min(100, (clampedElapsed / totalDuration.value) * 100);
        setPlaybackProgress(progress);
        // console.log(`🔊 Web Audio Progress: Elapsed ${clampedElapsed.toFixed(2)}s / ${totalDuration.value.toFixed(2)}s = ${progress.toFixed(1)}% (Raw elapsed: ${elapsed.toFixed(2)}, StartTime: ${startTime.value.toFixed(2)})`);
      }
    }

    if (isPlaying.value) {
      requestAnimationFrame(updatePlaybackProgress);
    }
  }

  function startProgressUpdates() {
    if (!isPlaying.value) {
        // console.log('📈 Progress updates not started: isPlaying is false.');
        return;
    }
    // console.log('📈 Starting progress updates loop.');
    requestAnimationFrame(updatePlaybackProgress);
  }

  function stopProgressUpdates() {
    // console.log('📉 Stopping progress updates loop.');
    // Perform one final update to ensure UI is accurate
    if (isUsingHtmlAudio.value && htmlAudio.value && htmlAudio.value.readyState >= 2) {
      const currentHtmlTime = htmlAudio.value.currentTime;
      const htmlDuration = htmlAudio.value.duration;
      setCurrentTime(currentHtmlTime);
      if (htmlDuration > 0) {
        setPlaybackProgress((currentHtmlTime / htmlDuration) * 100);
      }
    } else if (audioContext.value && currentSource.value && !isUsingHtmlAudio.value && totalDuration.value > 0) {
      const elapsed = audioContext.value.currentTime - startTime.value;
      const clampedElapsed = Math.max(0, Math.min(totalDuration.value, elapsed));
      setCurrentTime(clampedElapsed);
      setPlaybackProgress(Math.min(100, (clampedElapsed / totalDuration.value) * 100));
    }
  }

  function setTotalDuration(newDuration) {
    console.log(`📏 Setting total duration to: ${newDuration}s. Currently playing: ${isPlaying.value}. Current totalDuration: ${totalDuration.value}`);
    totalDuration.value = newDuration;
    // If not playing, reset progress. If playing, progress should update based on new duration.
    // This avoids resetting progress if called mid-playback with a refined duration.
    if (!isPlaying.value) {
      console.log('🔄 Resetting currentTime and playbackProgress to 0 (not currently playing).');
      setCurrentTime(0);
      setPlaybackProgress(0);
    } else {
      // If already playing and duration changes (e.g. full buffer loaded after stream)
      // re-calculate progress with new duration but current time.
      const currentPlaybackTime = currentTime.value; // from store
      if (newDuration > 0) {
        const progress = Math.min(100, (currentPlaybackTime / newDuration) * 100);
        setPlaybackProgress(progress);
        console.log(`⏯️ Kept current time ${currentPlaybackTime.toFixed(2)}s, updated progress to ${progress.toFixed(1)}% with new duration.`);
      }
    }
  }

  async function switchToHtmlAudio(audioBufferToPlay, preserveCurrentPlayTime = false, seekToTimeAfterSwitch = null) {
    console.log(`🔄 switchToHtmlAudio called. Preserve current time: ${preserveCurrentPlayTime}, Seek to time: ${seekToTimeAfterSwitch}`);
    if (!audioBufferToPlay) {
        console.error('switchToHtmlAudio: audioBufferToPlay is null or undefined.');
        return;
    }

    // 1. Aggressively stop any current Web Audio playback
    if (currentSource.value) {
      console.log('🛑 Stopping active Web Audio source before switching to HTML5 Audio.');
      currentSource.value.onended = null; // Important: remove onended handler
      try {
        currentSource.value.stop();
      } catch (e) {
        console.warn('Error stopping Web Audio source (it might have already stopped):', e.message);
      }
      currentSource.value.disconnect();
      setCurrentSource(null); // Clear the source in the store
    }
    // Also, if Web Audio context was playing (not just source), ensure it's suspended if we are fully stopping Web Audio.
    // However, setIsPlaying(false) should handle the logical state.
    // If audioContext was previously suspended, it might need to be resumed for HTML5 audio if any web audio nodes are reused (unlikely here).

    const wasPlaying = isPlaying.value; // Capture state before potential modification
    setIsPlaying(false); // Assume playback stops during switch, will be set to true if it resumes
    isUsingHtmlAudio.value = true; // Mark as using HTML5 audio immediately
     
    let timeToRestore = 0;
    if (seekToTimeAfterSwitch !== null) {
        timeToRestore = seekToTimeAfterSwitch;
    } else if (preserveCurrentPlayTime) {
        timeToRestore = currentTime.value; // Get current time from store
    }
    console.log(`⏳ Time to restore/seek after switch: ${timeToRestore.toFixed(2)}s. Was playing: ${wasPlaying}`);

    // 2. Convert AudioBuffer to Blob and create HTML5 Audio element
    try {
      const numberOfChannels = audioBufferToPlay.numberOfChannels;
      const sampleRate = audioBufferToPlay.sampleRate;
      const wavHeaderSize = 44;
      const pcmDataSize = audioBufferToPlay.length * numberOfChannels * 2; // 16-bit PCM
      const arrayBuffer = new ArrayBuffer(wavHeaderSize + pcmDataSize);
      const view = new DataView(arrayBuffer);

      // Write WAV Header
      const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      writeString(0, 'RIFF');
      view.setUint32(4, wavHeaderSize - 8 + pcmDataSize, true); // fileSize - 8
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true); // PCM chunk size
      view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
      view.setUint16(22, numberOfChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numberOfChannels * 2, true); // byteRate
      view.setUint16(32, numberOfChannels * 2, true); // blockAlign
      view.setUint16(34, 16, true); // bitsPerSample
      writeString(36, 'data');
      view.setUint32(40, pcmDataSize, true);

      // Write PCM data
      let offset = wavHeaderSize;
      for (let i = 0; i < audioBufferToPlay.length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, audioBufferToPlay.getChannelData(channel)[i]));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
          offset += 2;
        }
      }
      audioBlob.value = new Blob([view], { type: 'audio/wav' });

      if (htmlAudio.value) { // Clean up old one if exists
        htmlAudio.value.pause();
        htmlAudio.value.src = '';
        htmlAudio.value.onended = null;
        htmlAudio.value.ontimeupdate = null;
        htmlAudio.value.onloadeddata = null;
        // URL.revokeObjectURL might be needed if src was previously set with a blob
      }
      
      htmlAudio.value = new Audio();
      htmlAudio.value.src = URL.createObjectURL(audioBlob.value);
      htmlAudio.value.volume = (volume.value || 80) / 100; // volume from store

      htmlAudio.value.onended = () => {
        console.log('🎉 HTML5 Audio ended.');
        setIsPlaying(false);
        // Ensure progress reflects the very end
        if (htmlAudio.value && htmlAudio.value.duration) {
             setCurrentTime(htmlAudio.value.duration);
             setPlaybackProgress(100);
        }
        stopProgressUpdates(); // Should already be stopped if isPlaying is false
      };

      htmlAudio.value.ontimeupdate = () => {
        if (isPlaying.value && isUsingHtmlAudio.value) { // Redundant check for isUsingHtmlAudio but safe
          updatePlaybackProgress();
        }
      };
      
      htmlAudio.value.onloadeddata = () => {
        console.log(`🎧 HTML5 Audio loadeddata. Duration: ${htmlAudio.value.duration.toFixed(2)}s`);
        // Update totalDuration with the accurate duration from HTML5 audio
        // This is crucial because audioBufferToPlay.duration might be slightly different
        if (htmlAudio.value.duration && htmlAudio.value.duration > 0) {
            setTotalDuration(htmlAudio.value.duration); // This will call our refined setTotalDuration
            // Also update the store's audioDuration for the UI progress bar
            audioDuration.value = htmlAudio.value.duration;
        }

        if (timeToRestore > 0 && htmlAudio.value.duration && timeToRestore < htmlAudio.value.duration) {
          console.log(`🎯 Seeking HTML5 Audio to: ${timeToRestore.toFixed(2)}s`);
          htmlAudio.value.currentTime = timeToRestore;
          // setCurrentTime and setPlaybackProgress will be updated by ontimeupdate or next updatePlaybackProgress call
        }
        // setCurrentTime(htmlAudio.value.currentTime); // Reflect the (potentially seeked) time immediately
        // if (totalDuration.value > 0) setPlaybackProgress((htmlAudio.value.currentTime / totalDuration.value) * 100);


        if (wasPlaying || seekToTimeAfterSwitch !== null) { // If it was playing OR if we're seeking (implies intent to play from new spot)
          htmlAudio.value.play().then(() => {
            console.log('▶️ HTML5 Audio playback resumed/started after switch.');
            setIsPlaying(true);
            startProgressUpdates();
          }).catch(error => {
            console.error('switchToHtmlAudio: Failed to play HTML5 Audio after load:', error);
            setIsPlaying(false); // Ensure state is correct on failure
          });
        } else {
           // If it wasn't playing and not explicitly seeking, ensure UI reflects current (possibly 0) time
           updatePlaybackProgress(); // one-off update
        }
      };
      
      htmlAudio.value.onerror = (e) => {
        console.error("HTML5 Audio Error:", e);
        setIsPlaying(false);
        isUsingHtmlAudio.value = false; // Potentially switch back or handle error
      };

      console.log('✅ HTML5 Audio element created and event listeners set up.');

    } catch (error) {
      console.error('Failed to create or set up HTML5 Audio:', error);
      isUsingHtmlAudio.value = false; // Revert state on error
    }
  }


  function seekToPosition(positionPercentage, audioBufferForSeek) {
    const boundedPosition = Math.max(0, Math.min(100, positionPercentage));
    console.log(`🎯 seekToPosition called: ${boundedPosition}%. Using HTML5: ${isUsingHtmlAudio.value}`);

    if (isUsingHtmlAudio.value && htmlAudio.value) {
      if (totalDuration.value > 0) {
        const newTime = (boundedPosition / 100) * totalDuration.value;
        console.log(` HTML5 seek to time: ${newTime.toFixed(2)}s`);
        htmlAudio.value.currentTime = newTime;
        // setCurrentTime(newTime); // Let ontimeupdate handle this or updatePlaybackProgress
        // setPlaybackProgress(boundedPosition);
        // Don't automatically resume playback after seeking when paused
        // Let the user explicitly click play if they want to resume
        updatePlaybackProgress(); // Manual update for immediate feedback
      }
    } else if (audioBufferForSeek && totalDuration.value > 0 && audioContext.value) {
      // This branch implies we are seeking on a complete buffer using Web Audio API
      // (e.g., if HTML5 switch is disabled or failed)
      console.log(' Web Audio seek with unifiedBuffer.');
      const newTime = (boundedPosition / 100) * totalDuration.value;

      if (currentSource.value) { // Stop existing Web Audio source
        console.log(' Stopping current Web Audio source for seek.');
        currentSource.value.onended = null;
        try { currentSource.value.stop(); } catch(e) { /* ignore */ }
        currentSource.value.disconnect();
      }

      const newSource = audioContext.value.createBufferSource();
      newSource.buffer = audioBufferForSeek;
      newSource.connect(gainNode.value);
      setCurrentSource(newSource); // Update store

      // Adjust startTime for the new seek position. elapsed = audioContext.currentTime - startTime
      // So, startTime = audioContext.currentTime - newTime (where newTime is desired elapsed time)
      startTime.value = audioContext.value.currentTime - newTime;
      setCurrentTime(newTime);
      setPlaybackProgress(boundedPosition);
      
      console.log(` Starting Web Audio from seeked position: ${newTime.toFixed(2)}s. New startTime: ${startTime.value.toFixed(2)}`);
      newSource.start(0, newTime); // Start immediately at the newTime offset within the buffer

      if (isPlaying.value) { // If logical state is "playing"
        startProgressUpdates();
      } else { 
        // If was paused, seeking might imply user wants to start playing.
        // This part depends on desired UX. For now, just updates progress.
        // To auto-play after seek when paused:
        // setIsPlaying(true); startProgressUpdates();
      }
       newSource.onended = () => {
          // Only set isPlaying to false if this specific source ended and wasn't replaced by a new seek/stop
          if (currentSource.value === newSource) { 
            console.log('🔊 Web Audio source (seeked) ended.');
            setIsPlaying(false);
            stopProgressUpdates();
          }
      };
    } else {
        console.warn(`Seek ignored: No valid audio target. HTML5: ${isUsingHtmlAudio.value}, Buffer: ${!!audioBufferForSeek}, TotalDuration: ${totalDuration.value}`);
    }
  }
  
  function seekRelative(offsetSeconds, audioBufferForSeek) {
    if (totalDuration.value <= 0) {
        console.warn("seekRelative: totalDuration is 0, cannot seek.");
        return;
    }

    let currentOverallTime = 0;
    if (isUsingHtmlAudio.value && htmlAudio.value) {
        currentOverallTime = htmlAudio.value.currentTime;
    } else if (audioContext.value && currentSource.value) { // Web Audio
        // This assumes startTime is correctly reflecting cumulative playback for streams
        currentOverallTime = audioContext.value.currentTime - startTime.value;
    } else { // Fallback to store's currentTime if no active source
        currentOverallTime = currentTime.value;
    }
    
    const newTime = Math.max(0, Math.min(totalDuration.value, currentOverallTime + offsetSeconds));
    const newPositionPercentage = (newTime / totalDuration.value) * 100;
    console.log(`⏩ seekRelative by ${offsetSeconds}s. Current time: ${currentOverallTime.toFixed(2)}s, New time: ${newTime.toFixed(2)}s (${newPositionPercentage.toFixed(1)}%)`);
    seekToPosition(newPositionPercentage, audioBufferForSeek);
  }

  async function togglePlayback(audioBufferForPlayback) { // audioBufferForPlayback is likely the unifiedBuffer
    console.log(`⏯️ togglePlayback called. isPlaying: ${isPlaying.value}, usingHTML5: ${isUsingHtmlAudio.value}`);
    if (isUsingHtmlAudio.value && htmlAudio.value) {
      if (isPlaying.value) {
        htmlAudio.value.pause();
        setIsPlaying(false);
        stopProgressUpdates();
        console.log('⏸️ HTML5 Audio paused.');
      } else {
        try {
          await htmlAudio.value.play();
          setIsPlaying(true);
          startProgressUpdates();
          console.log('▶️ HTML5 Audio play resumed/started.');
        } catch (error) {
          console.error('HTML5 Audio play failed:', error);
          setIsPlaying(false);
        }
      }
    } else if (audioContext.value) { // Web Audio API playback
      if (!currentSource.value && audioBufferForPlayback) {
        // If no source, but we have a buffer (e.g. full audio ready, user hits play)
        console.log('🔊 No current Web Audio source, creating one from buffer for togglePlayback.');
        const newSource = audioContext.value.createBufferSource();
        newSource.buffer = audioBufferForPlayback;
        newSource.connect(gainNode.value);
        setCurrentSource(newSource); // Set it in store

        pausedTime.value = 0; // Play from start of this buffer
        startTime.value = audioContext.value.currentTime; // Mark start for this buffer
        
        newSource.start(0);
        setIsPlaying(true);
        startProgressUpdates();
        console.log('▶️ Web Audio started from buffer.');
        newSource.onended = () => {
            if (currentSource.value === newSource) {
                 console.log('🔊 Web Audio source (from toggle) ended.');
                 setIsPlaying(false); stopProgressUpdates();
            }
        };
        return;
      }
      
      if (!currentSource.value) {
        console.warn('togglePlayback: No Web Audio source and no buffer to play.');
        return;
      }

      if (isPlaying.value) { // Pause Web Audio
        // currentSource.value.stop() should not be used for pause, use context suspend
        if (audioContext.value.state === 'running') {
             await audioContext.value.suspend();
        }
        pausedTime.value = audioContext.value.currentTime - startTime.value; // Store elapsed time for current source
        setIsPlaying(false);
        stopProgressUpdates();
        console.log(`⏸️ Web Audio suspended. Paused at: ${pausedTime.value.toFixed(2)}s (relative to current source start)`);
      } else { // Resume Web Audio
        if (audioContext.value.state === 'suspended') {
            await audioContext.value.resume();
        }
        // Adjust startTime to account for the time spent paused:
        // startTime = new_context_current_time - previously_elapsed_time
        startTime.value = audioContext.value.currentTime - pausedTime.value;
        setIsPlaying(true);
        startProgressUpdates();
        console.log(`▶️ Web Audio resumed. New startTime: ${startTime.value.toFixed(2)}s (pausedTime was ${pausedTime.value.toFixed(2)}s)`);
      }
    }
  }

  function handleVolumeChangeLocal(event, applyVolumeFn) {
    const newVol = parseInt(event.target.value);
    setVolumeAndApply(newVol, (normalizedVol) => {
        // Apply to Web Audio context
        if (gainNode.value) gainNode.value.gain.value = normalizedVol;
        // Apply to external volume function (from useTTS)
        if (typeof applyVolumeFn === 'function') {
          applyVolumeFn(normalizedVol);
        }
    });
    
    // Apply to HTML5 audio directly here with proper normalization
    if (isUsingHtmlAudio.value && htmlAudio.value) {
      htmlAudio.value.volume = newVol / 100;
      console.log('📢 Updated HTML5 audio volume to:', newVol / 100);
    }
    
    // For UI feedback like a slider fill
    if (event.target.style && event.target.style.setProperty) {
      event.target.style.setProperty('--volume-percentage', `${newVol}%`);
    }
  }
  
  return {
    // Reactive state (mostly from store, but local refs for playback mechanism)
    isPlaying,          // from store
    currentSource,      // from store (the Web Audio AudioBufferSourceNode)
    playbackProgress,   // from store
    currentTime,        // from store
    volume,             // from store
    
    totalDuration,      // local ref, but mirrors audioDuration from store after set by useTTS
    startTime,          // local ref for Web Audio timing
    pausedTime,         // local ref for Web Audio pause timing

    isUsingHtmlAudio,   // local ref
    htmlAudio,          // local ref (the <audio> element)

    // Methods
    updatePlaybackProgress, // Called by startProgressUpdates
    startProgressUpdates,
    stopProgressUpdates,
    setTotalDuration,     // Called by useTTS when full buffer is ready or stream starts
    seekToPosition,       // Called by useTTS
    seekRelative,         // Called by useTTS
    togglePlayback,       // Called by useTTS
    switchToHtmlAudio,    // Called by useTTS
    handleVolumeChange: handleVolumeChangeLocal // Make sure App.vue uses this name if it was expecting it from here
  };
}