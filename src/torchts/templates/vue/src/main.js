import { createApp } from 'vue'
import App from './App.vue'
import { vuetify } from './plugins/vuetify'
import './assets/global.css'

const app = createApp(App)
app.use(vuetify)
app.mount('#app')