import { mount } from '@vue/test-utils'
import SpeakerSelection from '../SpeakerSelection.vue'
import { VOICE_OPTIONS, VOICES_BY_PIPELINE } from '../../constants/voices'

test('emits update:voice when voice changed in single mode', async () => {
  const wrapper = mount(SpeakerSelection, {
    props: {
      currentMode: 'single',
      voice: 'am_michael',
      multiSpeakerVoices: {},
      voiceOptions: VOICE_OPTIONS
    }
  })

  const selects = wrapper.findAll('select')
  await selects[1].setValue('af_alloy')
  expect(wrapper.emitted()['update:voice'][0]).toEqual(['af_alloy'])
})

test('changing pipeline emits first voice of new pipeline', async () => {
  const wrapper = mount(SpeakerSelection, {
    props: {
      currentMode: 'single',
      voice: 'am_michael',
      multiSpeakerVoices: {},
      voiceOptions: VOICE_OPTIONS
    }
  })

  const pipelineSelect = wrapper.findAll('select')[0]
  await pipelineSelect.setValue('british')
  const expected = VOICES_BY_PIPELINE['british'][0].value
  expect(wrapper.emitted()['update:voice'][0]).toEqual([expected])
})

test('emits update-multi-speaker-voice when multi voice changed', async () => {
  const wrapper = mount(SpeakerSelection, {
    props: {
      currentMode: 'multi',
      multiSpeakerVoices: { 1: 'am_michael' },
      voiceOptions: VOICE_OPTIONS,
      speakerCount: 2
    }
  })

  const select = wrapper.findAll('select')[0]
  await select.setValue('af_alloy')
  expect(wrapper.emitted()['update-multi-speaker-voice'][0]).toEqual([{ speaker: 1, value: 'af_alloy' }])
})
