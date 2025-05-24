export const VOICE_OPTIONS = [
  // American Female voices
  { value: 'af_alloy', label: 'Alloy (Female)' },
  { value: 'af_aoede', label: 'Aoede (Female)' },
  { value: 'af_bella', label: 'Bella (Female)' },
  { value: 'af_heart', label: 'Heart (Female)' },
  { value: 'af_jessica', label: 'Jessica (Female)' },
  { value: 'af_kore', label: 'Kore (Female)' },
  { value: 'af_nicole', label: 'Nicole (Female)' },
  { value: 'af_nova', label: 'Nova (Female)' },
  { value: 'af_river', label: 'River (Female)' },
  { value: 'af_sarah', label: 'Sarah (Female)' },
  { value: 'af_sky', label: 'Sky (Female)' },

  // American Male voices
  { value: 'am_adam', label: 'Adam (Male)' },
  { value: 'am_echo', label: 'Echo (Male)' },
  { value: 'am_eric', label: 'Eric (Male)' },
  { value: 'am_fenrir', label: 'Fenrir (Male)' },
  { value: 'am_liam', label: 'Liam (Male)' },
  { value: 'am_michael', label: 'Michael (Male)' },
  { value: 'am_onyx', label: 'Onyx (Male)' },
  { value: 'am_puck', label: 'Puck (Male)' },
  { value: 'am_santa', label: 'Santa (Male)' },

  // British Female voices
  { value: 'bf_alice', label: 'Alice (British Female)' },
  { value: 'bf_emma', label: 'Emma (British Female)' },
  { value: 'bf_isabella', label: 'Isabella (British Female)' },
  { value: 'bf_lily', label: 'Lily (British Female)' },

  // British Male voices
  { value: 'bm_daniel', label: 'Daniel (British Male)' },
  { value: 'bm_fable', label: 'Fable (British Male)' },
  { value: 'bm_george', label: 'George (British Male)' },
  { value: 'bm_lewis', label: 'Lewis (British Male)' },

  // Spanish Female voices
  { value: 'ef_dora', label: 'Dora (Spanish Female)' },

  // Spanish Male voices
  { value: 'em_alex', label: 'Alex (Spanish Male)' },
  { value: 'em_santa', label: 'Santa (Spanish Male)' },

  // French Female voices
  { value: 'ff_siwis', label: 'Siwis (French Female)' },

  // Hindi Female voices
  { value: 'hf_alpha', label: 'Alpha (Hindi Female)' },
  { value: 'hf_beta', label: 'Beta (Hindi Female)' },

  // Hindi Male voices
  { value: 'hm_omega', label: 'Omega (Hindi Male)' },
  { value: 'hm_psi', label: 'Psi (Hindi Male)' },

  // Italian Female voices
  { value: 'if_sara', label: 'Sara (Italian Female)' },

  // Italian Male voices
  { value: 'im_nicola', label: 'Nicola (Italian Male)' },

  // Japanese Female voices
  { value: 'jf_alpha', label: 'Alpha (Japanese Female)' },
  { value: 'jf_gongitsune', label: 'Gongitsune (Japanese Female)' },
  { value: 'jf_nezumi', label: 'Nezumi (Japanese Female)' },
  { value: 'jf_tebukuro', label: 'Tebukuro (Japanese Female)' },

  // Japanese Male voices
  { value: 'jm_kumo', label: 'Kumo (Japanese Male)' },

  // Portuguese Female voices
  { value: 'pf_dora', label: 'Dora (Portuguese Female)' },

  // Portuguese Male voices
  { value: 'pm_alex', label: 'Alex (Portuguese Male)' },
  { value: 'pm_santa', label: 'Santa (Portuguese Male)' },

  // Chinese Female voices
  { value: 'zf_xiaobei', label: 'Xiaobei (Chinese Female)' },
  { value: 'zf_xiaoni', label: 'Xiaoni (Chinese Female)' },
  { value: 'zf_xiaoxiao', label: 'Xiaoxiao (Chinese Female)' },
  { value: 'zf_xiaoyi', label: 'Xiaoyi (Chinese Female)' },

  // Chinese Male voices
  { value: 'zm_yunjian', label: 'Yunjian (Chinese Male)' },
  { value: 'zm_yunxi', label: 'Yunxi (Chinese Male)' },
  { value: 'zm_yunxia', label: 'Yunxia (Chinese Male)' },
  { value: 'zm_yunyang', label: 'Yunyang (Chinese Male)' }
]

// Add new pipeline options
export const PIPELINE_OPTIONS = [
  { value: 'american', label: 'American English' },
  { value: 'british', label: 'British English' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'italian', label: 'Italian' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'chinese', label: 'Chinese' }
]

// Group voices by pipeline
export const VOICES_BY_PIPELINE = {
  american: VOICE_OPTIONS.filter(v => v.value.startsWith('af_') || v.value.startsWith('am_')),
  british: VOICE_OPTIONS.filter(v => v.value.startsWith('bf_') || v.value.startsWith('bm_')),
  spanish: VOICE_OPTIONS.filter(v => v.value.startsWith('ef_') || v.value.startsWith('em_')),
  french: VOICE_OPTIONS.filter(v => v.value.startsWith('ff_')),
  hindi: VOICE_OPTIONS.filter(v => v.value.startsWith('hf_') || v.value.startsWith('hm_')),
  italian: VOICE_OPTIONS.filter(v => v.value.startsWith('if_') || v.value.startsWith('im_')),
  japanese: VOICE_OPTIONS.filter(v => v.value.startsWith('jf_') || v.value.startsWith('jm_')),
  portuguese: VOICE_OPTIONS.filter(v => v.value.startsWith('pf_') || v.value.startsWith('pm_')),
  chinese: VOICE_OPTIONS.filter(v => v.value.startsWith('zf_') || v.value.startsWith('zm_'))
}

export const DEFAULT_PIPELINE = 'american'
export const DEFAULT_VOICE = 'am_michael'
export const DEFAULT_VOLUME = 80 