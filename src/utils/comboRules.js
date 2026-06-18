const skillLength = {
  Početnik: [2, 3],
  Srednji: [3, 5],
  Napredni: [4, 6],
};

const isStrike = (step) => ['punch', 'kick', 'counter'].includes(step.category);
const isExit = (step) =>
  step?.category === 'movement' &&
  ['stepBack', 'exitLeft', 'exitRight', 'pivotLeft', 'pivotRight'].includes(step.id);

export const comboSignature = (steps = []) => steps.map((step) => step.id).join('-');

export const comboFeelingKey = (steps = []) => {
  const opening = steps
    .slice(0, 2)
    .map((step) => step.id)
    .join('-');
  const finisher = steps[steps.length - 1];
  return `${opening}:${finisher?.category || ''}:${finisher?.family || ''}:${finisher?.target || ''}:${finisher?.side || ''}`;
};

export const comboMemoryRecord = (combo) => {
  const stepIds = combo.steps.map((step) => step.id);

  return {
    signature: comboSignature(combo.steps),
    feeling: comboFeelingKey(combo.steps),
    stepIds,
    opening: stepIds.slice(0, 2).join('-'),
    finisher: stepIds[stepIds.length - 1] || '',
  };
};

export function hasTooManyRepeats(combo) {
  const counts = new Map();

  for (const step of combo.steps) {
    const count = (counts.get(step.id) || 0) + 1;
    counts.set(step.id, count);
    if (count > 2) return true;
  }

  return combo.steps.filter((step) => step.id === 'leadJab').length >= 3;
}

export function hasInvalidHighKickSpam(combo) {
  const highKickIndexes = combo.steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.category === 'kick' && step.family === 'high')
    .map(({ index }) => index);

  if (highKickIndexes.length > 1) return true;

  return combo.steps.some((step, index) => {
    const next = combo.steps[index + 1];
    return step.family === 'high' && next?.family === 'high';
  });
}

export function hasGenericTechnique(combo) {
  return combo.steps.some((step) => {
    const label = step.label.toLowerCase();
    const audioKey = step.audioKey.toLowerCase();

    if (label === 'blok' || label === 'low kick' || audioKey === 'low-kick') return true;

    const isKick = step.category === 'kick' || (step.category === 'counter' && step.family);
    if (isKick && !['leadLeg', 'rearLeg', 'body', 'head'].includes(step.target)) return true;

    if (step.category === 'defense' && !step.side && !label.includes('protiv')) return true;

    return false;
  });
}

export function hasDefenseWithoutCounter(combo) {
  return combo.steps.some((step, index) => {
    if (step.category !== 'defense') return false;
    const next = combo.steps[index + 1];
    if (!next) return true;
    return !['counter', 'punch', 'kick'].includes(next.category);
  });
}

export function hasInvalidLength(combo, skillLevel = 'Početnik', targetLength = null) {
  if (targetLength) return combo.steps.length !== targetLength;

  const [min, max] = skillLength[skillLevel] || skillLength.Početnik;
  return combo.steps.length < min || combo.steps.length > max;
}

const hasConsecutiveDuplicate = (combo) =>
  combo.steps.some((step, index) => index > 0 && combo.steps[index - 1].id === step.id);

const hasBadMovementFlow = (combo) =>
  combo.steps.some((step, index) => {
    if (step.category !== 'movement') return false;
    const next = combo.steps[index + 1];
    if (!next) return false;
    return !(isStrike(next) || isExit(next));
  });

const hasBadKneeSetup = (combo) =>
  combo.steps.some((step, index) => {
    if (step.family !== 'knee') return false;
    if (index === 0) return true;

    const previous = combo.steps[index - 1];
    const hasPressureBefore = combo.steps
      .slice(0, index)
      .some((candidate) => candidate.category === 'punch' || candidate.category === 'counter');

    return !hasPressureBefore || previous.category === 'defense';
  });

const endsWithGenericDefense = (combo, settings) => {
  const last = combo.steps[combo.steps.length - 1];
  if (!last || last.category !== 'defense') return false;
  return settings.comboMode !== 'Kretanje i izlazi';
};

const hasForbiddenSkillTechnique = (combo, skillLevel = 'Početnik', comboMode = 'Ruke + low kick') => {
  const levelKey =
    skillLevel === 'Napredni' ? 'advanced' : skillLevel === 'Srednji' ? 'intermediate' : 'beginner';

  return combo.steps.some((step, index) => {
    if (step.difficulty.includes(levelKey)) return false;

    const clinchBeginnerKnee =
      skillLevel === 'Početnik' &&
      comboMode === 'Klinč i koljena' &&
      step.family === 'knee' &&
      index >= 2;

    return !clinchBeginnerKnee;
  });
};

const modeUsesForbiddenTechnique = (combo, comboMode) => {
  if (comboMode === 'Samo ruke') {
    return combo.steps.some((step) => step.category === 'kick');
  }

  if (comboMode === 'Samo noge') {
    return combo.steps.some(
      (step) => step.category === 'punch' || step.category === 'counter' || step.category === 'defense'
    );
  }

  if (comboMode === 'Ruke + low kick') {
    return combo.steps.some((step) => {
      if (step.category === 'punch' || step.category === 'movement' || step.category === 'defense') return false;
      if (step.category === 'counter') return !['', 'low'].includes(step.family);
      return step.category === 'kick' && step.family !== 'low';
    });
  }

  if (comboMode === 'Kontra napadi') {
    return combo.steps[0]?.category !== 'defense' && combo.steps[0]?.id !== 'stepBack';
  }

  return false;
};

const hasBadRecentOverlap = (combo, recentCombos = []) => {
  const signature = comboSignature(combo.steps);
  if (recentCombos.some((recent) => recent.signature === signature)) return true;

  const opening = combo.steps
    .slice(0, 2)
    .map((step) => step.id)
    .join('-');
  const finisher = combo.steps[combo.steps.length - 1]?.id;

  if (opening && recentCombos.filter((recent) => recent.opening === opening).length >= 3) return true;
  if (finisher && recentCombos.filter((recent) => recent.finisher === finisher).length >= 3) return true;

  return false;
};

const hasImpossibleSequence = (combo) =>
  combo.steps.some((step, index) => {
    const next = combo.steps[index + 1];
    if (!next) return false;

    if (step.family === 'high' && next.family === 'high') return true;
    if (step.category === 'defense' && next.category === 'defense') return true;
    if (step.family === 'knee' && next.family === 'high') return true;

    return false;
  });

export function isValidCombo(combo, settings = {}, recentCombos = []) {
  if (!combo?.steps?.length) return false;
  if (hasInvalidLength(combo, settings.skillLevel, settings.targetLength || settings.strikesPerCombination)) {
    return false;
  }
  if (hasTooManyRepeats(combo)) return false;
  if (hasConsecutiveDuplicate(combo)) return false;
  if (hasInvalidHighKickSpam(combo)) return false;
  if (hasGenericTechnique(combo)) return false;
  if (hasDefenseWithoutCounter(combo)) return false;
  if (hasBadMovementFlow(combo)) return false;
  if (hasBadKneeSetup(combo)) return false;
  if (endsWithGenericDefense(combo, settings)) return false;
  if (hasForbiddenSkillTechnique(combo, settings.skillLevel, settings.comboMode)) return false;
  if (modeUsesForbiddenTechnique(combo, settings.comboMode)) return false;
  if (hasImpossibleSequence(combo)) return false;
  if (hasBadRecentOverlap(combo, recentCombos)) return false;

  return true;
}
