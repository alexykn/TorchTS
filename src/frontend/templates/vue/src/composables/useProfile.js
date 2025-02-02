import { ref, computed } from 'vue'
import { API_ENDPOINTS } from '../constants/api'

export function useProfiles() {
  const profiles = ref([])
  const currentProfile = ref(null)
  const isLoading = ref(false)

  async function loadProfiles() {
    isLoading.value = true
    try {
      const response = await fetch(API_ENDPOINTS.PROFILES)
      profiles.value = await response.json()
    } catch (error) {
      console.error('Error loading profiles:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function createProfile(name, voicePreset = null, volume = 0.7) {
    try {
      const response = await fetch(API_ENDPOINTS.PROFILES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          voice_preset: voicePreset,
          volume: volume
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to create profile')
      }
      
      const profile = await response.json()
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
      // Find and set current profile
      currentProfile.value = profiles.value.find(p => p.id === profileId)
      
      // Load profile's files
      const response = await fetch(`${API_ENDPOINTS.PROFILES}/${profileId}/files`)
      if (!response.ok) {
        throw new Error('Failed to load profile files')
      }
      
      const files = await response.json()
      
      // Load profile's audio outputs
      const audioResponse = await fetch(`${API_ENDPOINTS.PROFILES}/${profileId}/audio`)
      if (!audioResponse.ok) {
        throw new Error('Failed to load profile audio')
      }
      
      const audioFiles = await audioResponse.json()
      
      // Return combined profile data
      return {
        profile: currentProfile.value,
        files: files,
        audioFiles: audioFiles
      }
      
    } catch (error) {
      console.error('Error loading profile:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  async function deleteProfile(profileId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.PROFILES}/${profileId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete profile')
      }
      
      // Remove profile from list
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

  return {
    profiles,
    currentProfile,
    isLoading,
    loadProfiles,
    createProfile,
    selectProfile,
    deleteProfile
  }
}