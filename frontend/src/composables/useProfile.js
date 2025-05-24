import { storeToRefs } from 'pinia'
import { useProfileStore } from '../stores/profileStore'

export function useProfiles() {
  const store = useProfileStore()
  const { profiles, currentProfile, selectedProfile, isLoading } = storeToRefs(store)

  return {
    profiles,
    currentProfile,
    selectedProfile,
    isLoading,
    loadProfiles: store.loadProfiles,
    createProfile: store.createProfile,
    selectProfile: store.selectProfile,
    deleteProfile: store.deleteProfile,
    applyProfile: store.applyProfile,
    createAndApplyProfile: store.createAndApplyProfile,
    removeProfile: store.removeProfile
  }
}
