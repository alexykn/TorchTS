import { mount } from '@vue/test-utils'
import MainContent from '../MainContent.vue'

const defaultProps = {
  currentMode: 'single',
  text: '',
  voice: 'am_michael',
  volume: 50,
  multiSpeakerVoices: {},
  isPlaying: false,
  isGenerating: false,
  currentSource: null,
  playbackProgress: 0,
  isDownloadComplete: false,
  currentTime: 0,
  audioDuration: 0,
  progressMessage: '',
  isDark: false
}

function mountComponent() {
  return mount(MainContent, {
    props: { ...defaultProps },
    global: {
      stubs: {
        ModeSwitchTabs: { template: '<div />', emits: ['tabSwitch'] },
        TextEntryField: true,
        SpeakerSelection: true,
        AudioControls: true,
        PlaybackControls: true,
        ProgressBar: true,
        'v-main': true,
        'v-container': true,
        'v-card': true,
        'v-card-title': true,
        'v-card-text': true,
        'v-btn': true,
        'v-icon': true
      }
    }
  })
}

test('emits toggleTheme when theme button clicked', async () => {
  const wrapper = mountComponent()
  await wrapper.find('.theme-toggle').trigger('click')
  expect(wrapper.emitted().toggleTheme).toBeTruthy()
})

test('emits tabSwitch when ModeSwitchTabs emits tabSwitch', async () => {
  const wrapper = mountComponent()
  await wrapper.findComponent({ name: 'ModeSwitchTabs' }).vm.$emit('tabSwitch', 'multi')
  expect(wrapper.emitted().tabSwitch[0]).toEqual(['multi'])
})
