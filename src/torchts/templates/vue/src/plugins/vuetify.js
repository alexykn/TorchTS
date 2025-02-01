import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import '@mdi/font/css/materialdesignicons.css'

export const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#007aff',
          secondary: '#717171',
          background: '#ffffff',
          surface: '#fafafa',
          'surface-variant': '#f0f0f0',
          'on-surface-variant': '#666666',
          error: '#ff3b30',
          success: '#28c940',
          warning: '#ff9500',
          info: '#0a84ff',
        }
      },
      dark: {
        dark: true,
        colors: {
          primary: '#0a84ff',
          secondary: '#2a2a2a',
          background: '#1a1a1a',
          surface: '#2a2a2a',
          'surface-variant': '#404040',
          'on-surface-variant': '#a0a0a0',
          error: '#ff453a',
          success: '#32d74b',
          warning: '#ff9f0a',
          info: '#0a84ff',
        }
      }
    }
  }
}) 