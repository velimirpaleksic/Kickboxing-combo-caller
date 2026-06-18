import { resolveTechniqueIds, techniques } from '../data/techniques.js';
import { comboMemoryRecord, isValidCombo } from './comboRules.js';

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

const weightedItem = (items) => {
  const candidates = items.filter((item) => item.weight > 0);
  const total = candidates.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return null;

  let roll = Math.random() * total;
  for (const item of candidates) {
    roll -= item.weight;
    if (roll <= 0) return item.id;
  }

  return candidates[candidates.length - 1]?.id || null;
};

export const getComboNotation = (steps = []) => steps.map((step) => step.notation).join(' - ');

const levelKey = (skillLevel) => {
  if (skillLevel === 'Napredni') return 'advanced';
  if (skillLevel === 'Srednji') return 'intermediate';
  return 'beginner';
};

const clampTargetLength = (value) => {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return null;
  return Math.min(6, Math.max(2, number));
};

const normalizeSettings = (settings = {}) => ({
  skillLevel: settings.skillLevel || settings.difficulty || 'Početnik',
  generatorDifficulty: settings.generatorDifficulty || 'Normalan',
  comboMode: settings.comboMode || settings.comboType || 'Ruke + low kick',
  style: settings.style || 'Neutralno',
  stance: settings.stance || 'Ortodox',
  targetLength: clampTargetLength(settings.targetLength || settings.strikesPerCombination),
});

const groups = {
  leadPunches: ['leadJab', 'leadHook', 'leadUppercut'],
  rearPunches: ['rearCross', 'rearHook', 'rearUppercut'],
  punches: ['leadJab', 'rearCross', 'leadHook', 'rearHook', 'leadUppercut', 'rearUppercut'],
  lowKicks: ['leadLowKickLeadLeg', 'rearLowKickLeadLeg', 'leadLowKickRearLeg', 'rearLowKickRearLeg'],
  frontKicks: ['leadFrontKickBody', 'rearFrontKickBody'],
  middleKicks: ['leadMiddleKickBody', 'rearMiddleKickBody'],
  highKicks: ['leadHighKickHead', 'rearHighKickHead'],
  knees: ['leadKneeBody', 'rearKneeBody'],
  defenses: ['slipLeft', 'slipRight', 'highGuardHook', 'lowKickCheckLead', 'middleKickBlockRearArm'],
  simpleDefenses: ['slipLeft', 'slipRight'],
  exits: ['stepBack', 'exitLeft', 'exitRight', 'pivotLeft', 'pivotRight'],
  counters: ['counterRearCross', 'counterLeadHook', 'counterRearLowKick', 'counterRearMiddleKickBody'],
};

const templateLibrary = {
  'Samo ruke': [
    { slots: ['leadPunch', 'rearPunch'], weight: 8 },
    { slots: ['leadPunch', 'rearPunch', 'leadPunch'], weight: 7 },
    { slots: ['rearPunch', 'leadPunch', 'rearPunch'], weight: 4 },
    { slots: ['defense', 'counter', 'leadPunch'], weight: 3, minLevel: 'intermediate' },
    { slots: ['leadPunch', 'rearPunch', 'exit'], weight: 2, minLevel: 'intermediate' },
    { slots: ['leadPunch', 'rearPunch', 'leadPunch', 'rearPunch'], weight: 5, minLevel: 'advanced' },
    { slots: ['defense', 'counter', 'leadPunch', 'rearPunch'], weight: 4, minLevel: 'advanced' },
  ],
  'Samo noge': [
    { slots: ['frontKick', 'lowKick'], weight: 7 },
    { slots: ['lowKick', 'frontKick'], weight: 5 },
    { slots: ['lowKick', 'middleKick'], weight: 5, minLevel: 'intermediate' },
    { slots: ['rearLowKick', 'exit'], weight: 4 },
    { slots: ['frontKick', 'middleKick', 'exit'], weight: 2, minLevel: 'intermediate' },
    { slots: ['frontKick', 'lowKick', 'middleKick', 'exit'], weight: 5, minLevel: 'advanced' },
    { slots: ['lowKick', 'frontKick', 'rearLowKick', 'exit'], weight: 4, minLevel: 'advanced' },
  ],
  'Ruke + low kick': [
    { slots: ['leadPunch', 'rearPunch', 'rearLowKick'], weight: 10 },
    { slots: ['rearPunch', 'leadPunch', 'rearLowKick'], weight: 5 },
    { slots: ['leadPunch', 'leadPunch', 'rearLowKick'], weight: 3 },
    { slots: ['leadPunch', 'rearPunch', 'leadPunch', 'rearLowKick'], weight: 3, minLevel: 'intermediate' },
    { slots: ['defense', 'counter', 'rearLowKick'], weight: 2, minLevel: 'intermediate' },
  ],
  'Ruke + svi udarci nogama': [
    { slots: ['leadPunch', 'rearPunch', 'kickFinish'], weight: 9 },
    { slots: ['leadPunch', 'leadPunch', 'kickFinish'], weight: 4 },
    { slots: ['rearPunch', 'leadPunch', 'kickFinish'], weight: 4 },
    { slots: ['leadPunch', 'rearPunch', 'leadPunch', 'kickFinish'], weight: 3, minLevel: 'intermediate' },
    { slots: ['leadPunch', 'rearPunch', 'highKick'], weight: 1, minLevel: 'advanced' },
  ],
  'Miks sa odbranom': [
    { slots: ['leadPunch', 'rearPunch', 'stepBack'], weight: 2 },
    { slots: ['defense', 'counter', 'rearLowKick'], weight: 7, minLevel: 'intermediate' },
    { slots: ['defense', 'counter', 'leadPunch', 'rearLowKick'], weight: 5, minLevel: 'intermediate' },
    { slots: ['defense', 'counter', 'middleKick'], weight: 4, minLevel: 'intermediate' },
    { slots: ['leadPunch', 'rearPunch', 'defense', 'counter'], weight: 2, minLevel: 'intermediate' },
  ],
  'Klinč i koljena': [
    { slots: ['leadPunch', 'rearPunch', 'knee'], weight: 5 },
    { slots: ['rearPunch', 'leadPunch', 'knee', 'exit'], weight: 5, minLevel: 'intermediate' },
    { slots: ['leadPunch', 'rearPunch', 'knee', 'exit'], weight: 6, minLevel: 'intermediate' },
    { slots: ['leadPunch', 'rearPunch', 'highGuard', 'knee'], weight: 3, minLevel: 'advanced' },
  ],
  'Kontra napadi': [
    { slots: ['defense', 'counter', 'rearLowKick'], weight: 7, minLevel: 'intermediate' },
    { slots: ['defense', 'counter', 'leadPunch'], weight: 5, minLevel: 'intermediate' },
    { slots: ['defense', 'counter', 'middleKick'], weight: 4, minLevel: 'intermediate' },
    { slots: ['stepBack', 'rearPunch', 'rearLowKick'], weight: 2 },
    { slots: ['defense', 'counter', 'leadPunch', 'rearLowKick'], weight: 5, minLevel: 'advanced' },
    { slots: ['defense', 'counter', 'middleKick', 'exit'], weight: 4, minLevel: 'advanced' },
  ],
  'Kretanje i izlazi': [
    { slots: ['leadPunch', 'rearPunch', 'exit'], weight: 6 },
    { slots: ['stepBack', 'rearPunch', 'exit'], weight: 5 },
    { slots: ['leadPunch', 'rearPunch', 'pivot', 'rearLowKick'], weight: 5, minLevel: 'advanced' },
    { slots: ['stepBack', 'rearPunch', 'rearLowKick'], weight: 4 },
  ],
};

const levelRank = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const skillBounds = {
  Početnik: [2, 3],
  Srednji: [3, 5],
  Napredni: [4, 6],
};

const repeatSlots = (length, pattern) =>
  Array.from({ length }, (_, index) => pattern[index % pattern.length]);

const finishWithSlot = (length, pattern, finisher) => {
  if (length <= 1) return [finisher];
  return [...repeatSlots(length - 1, pattern), finisher];
};

const prefixSlots = (length, prefix, fillPattern, suffix = []) => {
  const safeSuffix = suffix.length >= length ? suffix.slice(0, length) : suffix;
  const slots = prefix.slice(0, Math.max(0, length - safeSuffix.length));

  while (slots.length < length - safeSuffix.length) {
    slots.push(fillPattern[slots.length % fillPattern.length]);
  }

  return [...slots, ...safeSuffix].slice(0, length);
};

const templatesForLength = (settings, length) => {
  const canCounter = levelRank[levelKey(settings.skillLevel)] >= levelRank.intermediate;
  const punchPattern = ['leadPunch', 'rearPunch', 'leadPunch', 'rearPunch'];
  const rearFirstPattern = ['rearPunch', 'leadPunch', 'rearPunch', 'leadPunch'];
  const kickPattern = ['frontKick', 'rearLowKick', 'lowKick', 'frontKick', 'lowKick'];
  const templates = [];

  const add = (slots, weight = 5, minLevel = null) => {
    if (slots.length === length) templates.push({ slots, weight, minLevel });
  };

  switch (settings.comboMode) {
    case 'Samo ruke':
      add(repeatSlots(length, punchPattern), 8);
      add(repeatSlots(length, rearFirstPattern), 4);
      if (length >= 3) add(finishWithSlot(length, punchPattern, 'exit'), 2, 'intermediate');
      if (canCounter && length >= 3) {
        add(prefixSlots(length, ['defense', 'counter'], punchPattern), 5, 'intermediate');
      }
      break;

    case 'Samo noge':
      add(repeatSlots(length, kickPattern), 7);
      if (length >= 3) add(finishWithSlot(length, kickPattern, 'stepBack'), 3);
      if (length >= 4) add(finishWithSlot(length, kickPattern, 'exit'), 3, 'intermediate');
      break;

    case 'Ruke + low kick':
      add(finishWithSlot(length, punchPattern, 'rearLowKick'), 10);
      add(finishWithSlot(length, rearFirstPattern, 'rearLowKick'), 5);
      if (canCounter && length >= 3) {
        add(prefixSlots(length, ['defense', 'counter'], punchPattern, ['rearLowKick']), 4, 'intermediate');
      }
      break;

    case 'Ruke + svi udarci nogama':
      add(finishWithSlot(length, punchPattern, 'kickFinish'), 9);
      add(finishWithSlot(length, rearFirstPattern, 'kickFinish'), 4);
      if (length >= 4) add(finishWithSlot(length, punchPattern, 'highKick'), 1, 'advanced');
      break;

    case 'Miks sa odbranom':
      add(finishWithSlot(length, punchPattern, 'stepBack'), 3);
      if (canCounter && length >= 3) {
        add(prefixSlots(length, ['defense', 'counter'], punchPattern, ['rearLowKick']), 8, 'intermediate');
        add(prefixSlots(length, ['defense', 'counter'], punchPattern, ['middleKick']), 4, 'intermediate');
      }
      break;

    case 'Klinč i koljena':
      if (length <= 2) {
        add(repeatSlots(length, punchPattern), 3);
      } else {
        add(prefixSlots(length, ['leadPunch', 'rearPunch'], punchPattern, ['knee']), 6);
        if (length >= 4) add(prefixSlots(length, ['rearPunch', 'leadPunch'], punchPattern, ['knee', 'stepBack']), 4);
        if (length >= 4) {
          add(prefixSlots(length, ['leadPunch', 'rearPunch'], punchPattern, ['knee', 'exit']), 5, 'intermediate');
        }
      }
      break;

    case 'Kontra napadi':
      if (canCounter) {
        add(prefixSlots(length, ['defense', 'counter'], punchPattern), 7, 'intermediate');
        if (length >= 3) add(prefixSlots(length, ['defense', 'counter'], punchPattern, ['rearLowKick']), 7, 'intermediate');
      } else {
        add(prefixSlots(length, ['stepBack', 'rearPunch'], punchPattern), 5);
        if (length >= 3) add(prefixSlots(length, ['stepBack', 'rearPunch'], punchPattern, ['rearLowKick']), 5);
      }
      break;

    case 'Kretanje i izlazi':
      add(prefixSlots(length, ['stepBack', 'rearPunch'], punchPattern), 5);
      if (length >= 3) add(prefixSlots(length, ['leadPunch', 'rearPunch'], punchPattern, ['stepBack']), 4);
      if (length >= 4) add(prefixSlots(length, ['leadPunch', 'rearPunch'], punchPattern, ['pivot', 'rearLowKick']), 5, 'advanced');
      break;

    default:
      add(finishWithSlot(length, punchPattern, 'rearLowKick'), 8);
      add(finishWithSlot(length, punchPattern, 'kickFinish'), 6);
  }

  return templates;
};

const templateAllowed = (template, settings) => {
  if (!template.minLevel) return true;
  return levelRank[levelKey(settings.skillLevel)] >= levelRank[template.minLevel];
};

const templatesFor = (settings) => {
  const base = templateLibrary[settings.comboMode] || templateLibrary['Ruke + low kick'];
  const allowed = settings.targetLength
    ? [
        ...base.filter(
          (template) =>
            templateAllowed(template, settings) && template.slots.length === settings.targetLength
        ),
        ...templatesForLength(settings, settings.targetLength).filter((template) =>
          templateAllowed(template, settings)
        ),
      ]
    : (() => {
        const [min, max] = skillBounds[settings.skillLevel] || skillBounds.Početnik;
        return base.filter(
          (template) =>
            templateAllowed(template, settings) &&
            template.slots.length >= min &&
            template.slots.length <= max
        );
      })();
  const difficulty = settings.generatorDifficulty;

  if (difficulty === 'Lagan') {
    return allowed.map((template) => ({
      ...template,
      weight: template.slots.length <= 3 ? template.weight * 1.8 : template.weight * 0.5,
    }));
  }

  if (difficulty === 'Težak') {
    return allowed.map((template) => ({
      ...template,
      weight: template.slots.length >= 4 ? template.weight * 1.8 : template.weight,
    }));
  }

  if (difficulty === 'Haos, ali realan') {
    return allowed.map((template) => ({
      ...template,
      weight: template.slots.length >= 4 ? template.weight * 2.1 : template.weight * 1.15,
    }));
  }

  return allowed;
};

const modeAllows = (technique, settings) => {
  switch (settings.comboMode) {
    case 'Samo ruke':
      return ['punch', 'defense', 'movement', 'counter'].includes(technique.category);
    case 'Samo noge':
      return technique.category === 'kick' || technique.category === 'movement';
    case 'Ruke + low kick':
      return (
        technique.category === 'punch' ||
        technique.category === 'movement' ||
        technique.category === 'defense' ||
        (technique.category === 'kick' && technique.family === 'low') ||
        (technique.category === 'counter' && ['', 'low'].includes(technique.family))
      );
    case 'Klinč i koljena':
      return (
        technique.category === 'punch' ||
        technique.category === 'movement' ||
        (technique.category === 'defense' && technique.id === 'highGuardHook') ||
        (technique.category === 'kick' && ['knee', 'low', 'middle'].includes(technique.family))
      );
    case 'Kontra napadi':
      return ['defense', 'movement', 'counter', 'punch', 'kick'].includes(technique.category);
    case 'Kretanje i izlazi':
      return ['movement', 'punch', 'kick'].includes(technique.category);
    case 'Ruke + svi udarci nogama':
    case 'Miks sa odbranom':
    default:
      return ['punch', 'kick', 'defense', 'movement', 'counter'].includes(technique.category);
  }
};

const skillAllows = (technique, settings, currentIds) => {
  const level = levelKey(settings.skillLevel);
  if (technique.difficulty.includes(level)) return true;

  if (
    settings.skillLevel === 'Početnik' &&
    settings.comboMode === 'Klinč i koljena' &&
    technique.family === 'knee' &&
    currentIds.length >= 2
  ) {
    return true;
  }

  return false;
};

const slotPool = (slot, currentIds) => {
  const previous = currentIds[currentIds.length - 1];

  if (slot === 'leadPunch') return groups.leadPunches;
  if (slot === 'rearPunch') return groups.rearPunches;
  if (slot === 'punch') return groups.punches;
  if (slot === 'lowKick') return groups.lowKicks;
  if (slot === 'rearLowKick') return ['rearLowKickLeadLeg', 'rearLowKickRearLeg'];
  if (slot === 'frontKick') return groups.frontKicks;
  if (slot === 'middleKick') return groups.middleKicks;
  if (slot === 'highKick') return groups.highKicks;
  if (slot === 'knee') return groups.knees;
  if (slot === 'highGuard') return ['highGuardHook'];
  if (slot === 'stepBack') return ['stepBack'];
  if (slot === 'pivot') return ['pivotLeft', 'pivotRight'];
  if (slot === 'exit') return groups.exits;

  if (slot === 'defense') {
    return currentIds.length === 0 ? groups.defenses : groups.simpleDefenses;
  }

  if (slot === 'counter') {
    if (previous === 'lowKickCheckLead') return ['counterRearLowKick', 'rearCross'];
    if (previous === 'middleKickBlockRearArm') return ['counterRearMiddleKickBody', 'counterRearCross'];
    if (previous === 'highGuardHook') return ['counterRearCross', 'rearKneeBody'];
    return groups.counters;
  }

  if (slot === 'kickFinish') {
    return [...groups.lowKicks, ...groups.frontKicks, ...groups.middleKicks, ...groups.highKicks];
  }

  return groups.punches;
};

const styleWeight = (technique, settings) => {
  let weight = technique.weight;

  if (settings.style === 'Bokserski pritisak') {
    if (technique.category === 'punch') weight *= 1.9;
    if (technique.category === 'kick') weight *= 0.45;
    if (technique.category === 'movement' && technique.id !== 'stepBack') weight *= 0.65;
  }

  if (settings.style === 'Kickboxing balans') {
    if (technique.category === 'punch') weight *= 1.15;
    if (['low', 'middle', 'front'].includes(technique.family)) weight *= 1.45;
  }

  if (settings.style === 'Low kick game') {
    if (technique.family === 'low') weight *= 2.6;
    if (technique.id === 'lowKickCheckLead') weight *= 2.2;
    if (technique.family === 'high') weight *= 0.25;
  }

  if (settings.style === 'Kontra stil') {
    if (technique.category === 'defense' || technique.category === 'counter') weight *= 2.2;
    if (technique.id === 'stepBack') weight *= 1.7;
  }

  if (settings.style === 'Sovjetski stil') {
    if (['leadJab', 'rearCross', 'stepBack', 'counterRearCross'].includes(technique.id)) weight *= 2.4;
    if (['leadHook', 'rearHook'].includes(technique.id)) weight *= 0.65;
    if (['knee', 'high'].includes(technique.family)) weight *= 0.15;
  }

  if (settings.style === 'Muay Thai stil') {
    if (['knee', 'middle', 'low'].includes(technique.family)) weight *= 2.1;
    if (['highGuardHook', 'lowKickCheckLead'].includes(technique.id)) weight *= 2.1;
    if (technique.category === 'punch' && technique.id !== 'leadJab' && technique.id !== 'rearCross') {
      weight *= 0.7;
    }
  }

  if (settings.generatorDifficulty === 'Lagan') {
    if (technique.family === 'high' || technique.family === 'knee') weight *= 0.3;
    if (technique.category === 'movement' && technique.id !== 'stepBack') weight *= 0.55;
  }

  if (settings.generatorDifficulty === 'Težak') {
    if (technique.category === 'movement' || technique.category === 'counter') weight *= 1.5;
    if (['middle', 'front', 'low'].includes(technique.family)) weight *= 1.35;
  }

  if (settings.generatorDifficulty === 'Haos, ali realan') {
    if (technique.category === 'movement' || technique.category === 'counter') weight *= 1.8;
    if (['high', 'knee', 'middle'].includes(technique.family)) weight *= 1.6;
  }

  return weight;
};

const rhythmWeight = (technique, currentIds) => {
  const previous = techniques[currentIds[currentIds.length - 1]];
  const sameCount = currentIds.filter((id) => id === technique.id).length;
  let weight = 1;

  if (sameCount > 0) weight *= 0.28;
  if (sameCount > 1) weight = 0;

  if (previous?.category === 'punch' && technique.category === 'punch') {
    weight *= previous.side !== technique.side ? 1.45 : 0.45;
  }

  if (previous?.family === 'high' && technique.family === 'high') weight = 0;
  if (currentIds.some((id) => techniques[id]?.family === 'high') && technique.family === 'high') weight = 0;

  return weight;
};

const pickTechniqueForSlot = (slot, settings, currentIds) => {
  const candidates = slotPool(slot, currentIds)
    .map((id) => techniques[id])
    .filter(Boolean)
    .filter((technique) => modeAllows(technique, settings))
    .filter((technique) => skillAllows(technique, settings, currentIds))
    .map((technique) => ({
      id: technique.id,
      weight: styleWeight(technique, settings) * rhythmWeight(technique, currentIds),
    }));

  return weightedItem(candidates);
};

const makeCombo = (ids, settings) => {
  const steps = resolveTechniqueIds(ids, settings.stance);
  const combo = {
    steps,
    notation: getComboNotation(steps),
    source: 'generated',
  };

  return {
    ...combo,
    signature: comboMemoryRecord(combo).signature,
  };
};

const fallbackByMode = {
  'Samo ruke': [
    ['leadJab', 'rearCross'],
    ['leadJab', 'rearCross', 'leadHook'],
    ['rearCross', 'leadHook', 'rearCross'],
    ['leadJab', 'rearCross', 'leadHook', 'rearCross'],
    ['slipRight', 'counterRearCross', 'leadHook', 'rearCross'],
  ],
  'Samo noge': [
    ['leadFrontKickBody', 'rearLowKickLeadLeg'],
    ['leadLowKickLeadLeg', 'rearFrontKickBody'],
    ['rearLowKickLeadLeg', 'exitRight'],
    ['leadFrontKickBody', 'rearLowKickLeadLeg', 'rearMiddleKickBody', 'exitRight'],
  ],
  'Ruke + low kick': [
    ['leadJab', 'rearCross', 'rearLowKickLeadLeg'],
    ['rearCross', 'leadHook', 'rearLowKickLeadLeg'],
    ['leadJab', 'rearCross', 'leadHook', 'rearLowKickLeadLeg'],
  ],
  'Ruke + svi udarci nogama': [
    ['leadJab', 'rearCross', 'rearMiddleKickBody'],
    ['leadJab', 'leadHook', 'rearLowKickLeadLeg'],
    ['leadJab', 'rearCross', 'leadHook', 'rearMiddleKickBody'],
  ],
  'Miks sa odbranom': [
    ['leadJab', 'rearCross', 'stepBack'],
    ['slipRight', 'counterRearCross', 'leadHook'],
    ['slipRight', 'counterRearCross', 'leadHook', 'rearLowKickLeadLeg'],
  ],
  'Klinč i koljena': [
    ['leadJab', 'rearCross', 'leadKneeBody'],
    ['rearCross', 'leadHook', 'rearKneeBody'],
    ['leadJab', 'rearCross', 'leadKneeBody', 'exitRight'],
  ],
  'Kontra napadi': [
    ['stepBack', 'rearCross', 'rearLowKickLeadLeg'],
    ['slipRight', 'counterRearCross', 'rearLowKickLeadLeg'],
    ['slipRight', 'counterRearCross', 'leadHook', 'rearLowKickLeadLeg'],
  ],
  'Kretanje i izlazi': [
    ['stepBack', 'rearCross', 'exitRight'],
    ['leadJab', 'rearCross', 'exitLeft'],
    ['leadJab', 'rearCross', 'pivotLeft', 'rearLowKickLeadLeg'],
  ],
};

const repeatIds = (length, pattern) =>
  Array.from({ length }, (_, index) => pattern[index % pattern.length]);

const finishWithId = (length, pattern, finisher) => {
  if (length <= 1) return [finisher];
  return [...repeatIds(length - 1, pattern), finisher];
};

const prefixIds = (length, prefix, fillPattern, suffix = []) => {
  const safeSuffix = suffix.length >= length ? suffix.slice(0, length) : suffix;
  const ids = prefix.slice(0, Math.max(0, length - safeSuffix.length));

  while (ids.length < length - safeSuffix.length) {
    ids.push(fillPattern[ids.length % fillPattern.length]);
  }

  return [...ids, ...safeSuffix].slice(0, length);
};

const fallbackIdsForLength = (settings, length) => {
  const targetLength = clampTargetLength(length) || 3;
  const punches = ['leadJab', 'rearCross', 'leadHook', 'rearHook'];
  const kicks = [
    'leadFrontKickBody',
    'rearLowKickLeadLeg',
    'leadLowKickRearLeg',
    'rearFrontKickBody',
    'rearLowKickRearLeg',
  ];
  const canCounter = levelRank[levelKey(settings.skillLevel)] >= levelRank.intermediate;

  switch (settings.comboMode) {
    case 'Samo ruke':
      return repeatIds(targetLength, punches);

    case 'Samo noge':
      return targetLength >= 5
        ? finishWithId(targetLength, kicks, 'stepBack')
        : repeatIds(targetLength, kicks);

    case 'Ruke + low kick':
      return finishWithId(targetLength, punches, 'rearLowKickLeadLeg');

    case 'Ruke + svi udarci nogama':
      return finishWithId(targetLength, punches, 'rearLowKickLeadLeg');

    case 'Miks sa odbranom':
      if (canCounter && targetLength >= 3) {
        return prefixIds(targetLength, ['slipRight', 'counterRearCross'], punches, ['rearLowKickLeadLeg']);
      }
      return finishWithId(targetLength, punches, 'rearLowKickLeadLeg');

    case 'Klinč i koljena':
      if (targetLength <= 2) return repeatIds(targetLength, punches);
      return prefixIds(targetLength, ['leadJab', 'rearCross'], punches, ['leadKneeBody']);

    case 'Kontra napadi':
      if (canCounter) {
        return targetLength >= 3
          ? prefixIds(targetLength, ['slipRight', 'counterRearCross'], punches, ['rearLowKickLeadLeg'])
          : ['slipRight', 'counterRearCross'].slice(0, targetLength);
      }
      return targetLength >= 3
        ? prefixIds(targetLength, ['stepBack', 'rearCross'], punches, ['rearLowKickLeadLeg'])
        : ['stepBack', 'rearCross'].slice(0, targetLength);

    case 'Kretanje i izlazi':
      return targetLength >= 3
        ? prefixIds(targetLength, ['stepBack', 'rearCross'], punches, ['rearLowKickLeadLeg'])
        : ['stepBack', 'rearCross'].slice(0, targetLength);

    default:
      return finishWithId(targetLength, punches, 'rearLowKickLeadLeg');
  }
};

const buildFromTemplate = (template, settings) => {
  const ids = [];

  for (const slot of template.slots) {
    const selected = pickTechniqueForSlot(slot, settings, ids);
    if (selected) ids.push(selected);
  }

  return makeCombo(ids, settings);
};

const safeFallbackCombo = (settings, recentCombos = []) => {
  const exactFallbackIds = fallbackIdsForLength(settings, settings.targetLength || 3);
  const variants = [
    exactFallbackIds,
    ...(fallbackByMode[settings.comboMode] || []),
    ['leadJab', 'rearCross', 'rearLowKickLeadLeg'],
  ];
  const recentSignatures = new Set(recentCombos.map((combo) => combo.signature));
  const candidates = variants
    .map((ids) => makeCombo(ids, settings))
    .filter((combo) => isValidCombo(combo, settings, []));

  return (
    candidates.find((combo) => !recentSignatures.has(combo.signature)) ||
    candidates[0] ||
    makeCombo(exactFallbackIds, settings)
  );
};

export function generateCombo(options = {}) {
  const { recentCombos = [] } = options;
  const settings = normalizeSettings(options);
  const templates = templatesFor(settings);

  for (let attempts = 0; attempts < 10; attempts += 1) {
    const templateId = weightedItem(
      templates.map((template, index) => ({
        id: index,
        weight: template.weight,
      }))
    );

    const template = templates[templateId] || randomItem(templates);
    if (!template) break;

    const combo = buildFromTemplate(template, settings);
    if (isValidCombo(combo, settings, recentCombos)) return combo;
  }

  return safeFallbackCombo(settings, recentCombos);
}

const normalizeCustomCombo = (combo, stance) => {
  const steps = resolveTechniqueIds(
    combo.steps.map((step) => step.id),
    stance
  );
  const normalized = {
    ...combo,
    steps,
    notation: getComboNotation(steps),
    source: 'custom',
  };

  return {
    ...normalized,
    signature: comboMemoryRecord(normalized).signature,
  };
};

export const pickCombo = (settings, customCombos = [], recentCombos = []) => {
  const normalized = normalizeSettings(settings);

  if (customCombos.length > 0 && Math.random() < 0.2) {
    const candidates = customCombos
      .map((combo) => normalizeCustomCombo(combo, normalized.stance))
      .filter((combo) => isValidCombo(combo, normalized, recentCombos));

    if (candidates.length > 0) return randomItem(candidates);
  }

  return generateCombo({
    ...normalized,
    recentCombos,
  });
};
