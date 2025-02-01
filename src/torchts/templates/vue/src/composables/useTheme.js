import { ref, onMounted, onUnmounted } from 'vue'

export function useTheme() {
  const isDark = ref(false)
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')

  const updateTheme = (e) => {
    isDark.value = e.matches
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
  }

  const toggleTheme = () => {
    isDark.value = !isDark.value
    document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  }

  onMounted(() => {
    isDark.value = prefersDark.matches
    document.documentElement.setAttribute('data-theme', prefersDark.matches ? 'dark' : 'light')
    prefersDark.addEventListener('change', updateTheme)
  })

  onUnmounted(() => {
    prefersDark.removeEventListener('change', updateTheme)
  })

  return {
    isDark,
    toggleTheme
  }
} 