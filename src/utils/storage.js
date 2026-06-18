import { techniques } from '../data/techniques.js';

const SETTINGS_KEY = 'kombinacije.settings';
const CUSTOM_COMBOS_KEY = 'kombinacije.customCombos';
const USE_CUSTOM_KEY = 'kombinacije.useCustomCombos';

export const DEFAULT_SETTINGS = {
  roundDuration: 180,
  restDuration: 60,
  rounds: 3,
  speed: 'Srednje',
  strikesPerCombination: 3,
  combinationPause: 1,
  combinationRepeats: 1,
  voiceSpeed: 'Normalno',
  comboTempo: 'Normalno',
  skillLevel: 'Početnik',
  generatorDifficulty: 'Normalan',
  comboMode: 'Ruke + low kick',
  style: 'Neutralno',
  stance: 'Ortodox',
  notationDisplay: 'Ispod kombinacije',
  voiceMode: 'off',
  selectedVoiceURI: '',
  readNumbers: false,
};

const generatorDifficultyMigration = {
  Realan: 'Normalan',
  Raznovrsno: 'Težak',
};

const readJson = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeVoiceMode = (settings) => {
  if (settings.voiceMode === 'device' || settings.voiceMode === 'recorded' || settings.voiceMode === 'off') {
    return settings.voiceMode;
  }

  if (settings.voiceEnabled === false) return 'off';
  if (settings.voiceMode === 'recorded') return 'recorded';

  return DEFAULT_SETTINGS.voiceMode;
};

const clampNumber = (value, fallback, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

export const loadSettings = () => {
  const saved = readJson(SETTINGS_KEY, {});
  const savedSettings = { ...saved };
  delete savedSettings[['combinations', 'PerRound'].join('')];
  delete savedSettings[['combos', 'PerRound'].join('')];

  return {
    ...DEFAULT_SETTINGS,
    ...savedSettings,
    strikesPerCombination: clampNumber(
      saved.strikesPerCombination,
      DEFAULT_SETTINGS.strikesPerCombination,
      2,
      6
    ),
    combinationPause: clampNumber(saved.combinationPause, DEFAULT_SETTINGS.combinationPause, 0.5, 3),
    combinationRepeats: clampNumber(
      saved.combinationRepeats,
      DEFAULT_SETTINGS.combinationRepeats,
      1,
      5
    ),
    voiceSpeed: saved.voiceSpeed || DEFAULT_SETTINGS.voiceSpeed,
    comboTempo: saved.comboTempo || DEFAULT_SETTINGS.comboTempo,
    skillLevel: saved.skillLevel || saved.difficulty || DEFAULT_SETTINGS.skillLevel,
    generatorDifficulty:
      generatorDifficultyMigration[saved.generatorDifficulty] ||
      saved.generatorDifficulty ||
      DEFAULT_SETTINGS.generatorDifficulty,
    comboMode: saved.comboMode || saved.comboType || DEFAULT_SETTINGS.comboMode,
    notationDisplay: saved.notationDisplay || DEFAULT_SETTINGS.notationDisplay,
    voiceMode: normalizeVoiceMode(saved),
  };
};

export const saveSettings = (settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

const normalizeStep = (step) => {
  if (step?.id && techniques[step.id]) return techniques[step.id];
  return null;
};

const normalizeCustomCombo = (combo) => {
  if (Array.isArray(combo.steps) && combo.steps.length > 0) {
    const steps = combo.steps.map(normalizeStep).filter(Boolean);
    if (steps.length === 0) return null;

    return {
      id: combo.id || crypto.randomUUID(),
      note: combo.note || '',
      steps,
    };
  }

  return null;
};

export const loadCustomCombos = () =>
  readJson(CUSTOM_COMBOS_KEY, []).map(normalizeCustomCombo).filter(Boolean);

export const saveCustomCombos = (combos) => {
  localStorage.setItem(CUSTOM_COMBOS_KEY, JSON.stringify(combos));
};

export const loadUseCustomCombos = () => readJson(USE_CUSTOM_KEY, false);

export const saveUseCustomCombos = (enabled) => {
  localStorage.setItem(USE_CUSTOM_KEY, JSON.stringify(enabled));
};
