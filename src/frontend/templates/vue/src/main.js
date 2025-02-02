import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { vuetify } from './plugins/vuetify'
import './assets/global.css'

const app = createApp(App)
app.use(createPinia())
app.use(vuetify)
app.mount('#app')