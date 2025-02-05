import { ref } from 'vue'
import { useAPI } from './useAPI'

export function useProfiles() {
  const profiles = ref([])
  const currentProfile = ref(null)
  const isLoading = ref(false)

  async function loadProfiles() {
    isLoading.value = true
    try {
      const api = useAPI()
      profiles.value = await api.getProfiles()
      
      const savedProfileId = localStorage.getItem('selectedProfileId')
      if (!savedProfileId && profiles.value.length > 0) {
        const defaultProfile = profiles.value[0]
        await selectProfile(defaultProfile.id)
        localStorage.setItem('selectedProfileId', defaultProfile.id)
      }
    } catch (error) {
      console.error('Error loading profiles:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function createProfile(name, voicePreset = null, volume = 0.7) {
    try {
      const api = useAPI()
      const profile = await api.createProfile({
        name,
        voice_preset: voicePreset,
        volume
      })
      profiles.value.push(profile)
      return profile
    } catch (error) {
      console.error('Error creating profile:', error)
      throw error
    }
  }

  async function selectProfile(profileId) {
    if (!profileId) return null
    
    isLoading.value = true
    try {
      currentProfile.value = profiles.value.find(p => p.id === profileId)
      
      const api = useAPI()
      const files = await api.getProfileFiles(profileId)
      const audioResponse = await api.getProfileAudio(profileId)
      
      return {
        profile: currentProfile.value,
        files,
        audioFiles: audioResponse
      }
    } catch (error) {
      console.error('Error selecting profile:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  async function deleteProfile(profileId) {
    try {
      const api = useAPI()
      await api.deleteProfile(profileId)
      profiles.value = profiles.value.filter(p => p.id !== profileId)
      if (currentProfile.value?.id === profileId) {
        currentProfile.value = null
      }
      return true
    } catch (error) {
      console.error('Error deleting profile:', error)
      throw error
    }
  }

  // --- NEW WRAPPER FUNCTIONS FOR PROFILE MANAGEMENT ---

  /**
   * Applies (selects) a profile by ID:
   * - Saves the selected ID in localStorage
   * - Calls the standard selectProfile API
   * - Uses optional callbacks to update UI-controlled state (e.g., voice, volume, files)
   */
  async function applyProfile(profileId, { setVoice, setVolume, setFiles } = {}) {
    if (!profileId) return null
    localStorage.setItem('selectedProfileId', profileId)
    const profileData = await selectProfile(profileId)
    if (setVoice) {
      setVoice(profileData.profile.voice_preset || null)
    }
    if (setVolume) {
      setVolume(profileData.profile.volume ? (profileData.profile.volume * 100) : 70)
    }
    if (setFiles) {
      setFiles(profileData.files.map(f => ({
        ...f,
        name: f.filename,
        type: f.file_type
      })))
    }
    return profileData
  }

  /**
   * Creates a profile via API and then applies it.
   */
  async function createAndApplyProfile(name, voicePreset = null, volume = 0.7, { setVoice, setVolume, setFiles } = {}) {
    const newProfile = await createProfile(name, voicePreset, volume)
    await applyProfile(newProfile.id, { setVoice, setVolume, setFiles })
    return newProfile
  }

  /**
   * Deletes the profile and – if it was the selected one – clears the selection.
   */
  async function removeProfile(profileId) {
    await deleteProfile(profileId)
    if (localStorage.getItem('selectedProfileId') == profileId) {
      localStorage.removeItem('selectedProfileId')
    }
  }

  return {
    profiles,
    currentProfile,
    isLoading,
    loadProfiles,
    createProfile,
    selectProfile,
    deleteProfile,
    // Expose the new wrapper functions so they can be used in the UI
    applyProfile,
    createAndApplyProfile,
    removeProfile
  }
}