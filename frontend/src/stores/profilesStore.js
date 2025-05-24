import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useProfilesStore = defineStore('profiles', () => {
  const profiles = ref([])
  const currentProfile = ref(null)
  const isLoading = ref(false)

  function setProfiles(list) {
    profiles.value = list
  }

  function setCurrentProfile(profile) {
    currentProfile.value = profile
  }

  function setLoading(val) {
    isLoading.value = val
  }

  return {
    profiles,
    currentProfile,
    isLoading,
    setProfiles,
    setCurrentProfile,
    setLoading
  }
})
