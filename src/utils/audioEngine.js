import { numberAudioKeys, phraseByAudioKey, TEST_VOICE_TEXT } from '../data/phraseList.js';
import { getClip } from './voiceStorage.js';

const ALLOWED_VOICE_PREFIXES = ['sr', 'bs', 'hr'];
const voiceSpeedRates = {
  Sporo: 0.85,
  Normalno: 1,
  Brzo: 1.2,
  'Vrlo brzo': 1.4,
};
const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const resolveVoiceRate = (voiceSpeed = 'Normalno', voiceSpeedRate = null) => {
  const explicitRate = Number(voiceSpeedRate);
  if (Number.isFinite(explicitRate)) return Math.min(1.4, Math.max(0.85, explicitRate));
  return voiceSpeedRates[voiceSpeed] || voiceSpeedRates.Normalno;
};

export const isAllowedDeviceVoice = (voice) => {
  const language = (voice?.lang || '').toLowerCase();
  return ALLOWED_VOICE_PREFIXES.some((prefix) => language.startsWith(prefix));
};

class AudioEngine {
  constructor() {
    this.voiceMode = 'off';
    this.readNumbers = false;
    this.selectedVoiceURI = '';
    this.voiceSpeed = 'Normalno';
    this.voiceSpeedRate = voiceSpeedRates.Normalno;
    this.currentAudio = null;
    this.currentObjectUrl = '';
    this.playToken = 0;
    this.missingAudioKeys = new Set();
  }

  configure({
    voiceMode = 'off',
    readNumbers = false,
    selectedVoiceURI = '',
    voiceSpeed = 'Normalno',
    voiceSpeedRate = null,
  } = {}) {
    this.voiceMode = voiceMode;
    this.readNumbers = readNumbers;
    this.selectedVoiceURI = selectedVoiceURI;
    this.voiceSpeed = voiceSpeed;
    this.voiceSpeedRate = resolveVoiceRate(voiceSpeed, voiceSpeedRate);
  }

  setAudioMode(mode) {
    this.voiceMode = mode;
  }

  setVoiceURI(voiceURI) {
    this.selectedVoiceURI = voiceURI;
  }

  async unlock() {
    return Promise.resolve();
  }

  preloadCombo() {
    return undefined;
  }

  getAllowedDeviceVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices().filter(isAllowedDeviceVoice);
  }

  async loadAllowedDeviceVoices(timeout = 800) {
    const firstPass = this.getAllowedDeviceVoices();
    if (firstPass.length > 0 || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return firstPass;
    }

    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      const finish = () => {
        synth.removeEventListener?.('voiceschanged', finish);
        resolve(this.getAllowedDeviceVoices());
      };

      synth.addEventListener?.('voiceschanged', finish, { once: true });
      window.setTimeout(finish, timeout);
    });
  }

  resolveVoice() {
    const voices = this.getAllowedDeviceVoices();
    if (voices.length === 0) return null;
    return voices.find((voice) => voice.voiceURI === this.selectedVoiceURI) || voices[0];
  }

  getMissingAudioKeys() {
    return [...this.missingAudioKeys];
  }

  markMissing(audioKey) {
    if (!audioKey) return;
    this.missingAudioKeys.add(audioKey);
    window.dispatchEvent?.(
      new CustomEvent('kombinacije:missing-audio', {
        detail: { audioKey },
      })
    );
  }

  stopAudio() {
    this.playToken += 1;

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = '';
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  stop() {
    this.stopAudio();
  }

  pause() {
    this.stopAudio();
  }

  resume() {
    this.playToken += 1;
  }

  async testVoice() {
    if (this.voiceMode !== 'device') return false;
    return this.speakText(TEST_VOICE_TEXT);
  }

  async playEvent(audioKey) {
    const label = phraseByAudioKey[audioKey]?.label || audioKey;
    await this.playAudioKey(audioKey, label);
  }

  async playCombo(comboSteps = [], { readNumbers = this.readNumbers } = {}) {
    if (!Array.isArray(comboSteps) || comboSteps.length === 0 || this.voiceMode === 'off') return;

    this.playToken += 1;
    const token = this.playToken;

    for (let index = 0; index < comboSteps.length; index += 1) {
      if (token !== this.playToken) return;

      if (readNumbers && numberAudioKeys[index]) {
        await this.playAudioKey(numberAudioKeys[index], phraseByAudioKey[numberAudioKeys[index]]?.label);
        await pause(90);
      }

      if (token !== this.playToken) return;
      const step = comboSteps[index];
      await this.playAudioKey(step.audioKey, step.label);
      await pause(140);
    }
  }

  async playAudioKey(audioKey, fallbackText = '') {
    if (!audioKey || this.voiceMode === 'off') return false;

    const phraseText = phraseByAudioKey[audioKey]?.label || fallbackText;

    if (this.voiceMode === 'device') {
      if (!phraseText) return false;
      return this.speakText(phraseText);
    }

    if (this.voiceMode === 'recorded') {
      const clip = await getClip(audioKey);
      if (!clip?.blob) {
        this.markMissing(audioKey);
        return false;
      }

      return this.playBlob(clip.blob);
    }

    return false;
  }

  async speakText(text) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;

    await this.loadAllowedDeviceVoices();
    const voice = this.resolveVoice();
    if (!voice || !isAllowedDeviceVoice(voice)) return false;

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = this.voiceSpeedRate;
      utterance.pitch = 1;

      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  async playBlob(blob) {
    if (!blob) return false;

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = '';
    }

    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    try {
      audio.playbackRate = this.voiceSpeedRate;
    } catch {
      // Some browsers ignore playbackRate for recorded blobs.
    }
    this.currentAudio = audio;
    this.currentObjectUrl = objectUrl;

    try {
      await audio.play();
      await new Promise((resolve) => {
        audio.addEventListener('ended', resolve, { once: true });
        audio.addEventListener('pause', resolve, { once: true });
        audio.addEventListener('error', resolve, { once: true });
      });
      return true;
    } catch {
      return false;
    } finally {
      if (this.currentAudio === audio) {
        this.currentAudio = null;
      }
      if (this.currentObjectUrl === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        this.currentObjectUrl = '';
      }
    }
  }
}

export const audioEngine = new AudioEngine();

export const playEvent = (...args) => audioEngine.playEvent(...args);
export const playCombo = (...args) => audioEngine.playCombo(...args);
export const stopAudio = (...args) => audioEngine.stopAudio(...args);
export const setAudioMode = (...args) => audioEngine.setAudioMode(...args);
export const testVoice = (...args) => audioEngine.testVoice(...args);
