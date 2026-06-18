import { techniqueList } from './techniques.js';

export const eventPhrases = [
  { audioKey: 'spremi-se', label: 'Spremi se', group: 'events' },
  { audioKey: 'runda-pocinje', label: 'Runda počinje', group: 'events' },
  { audioKey: 'pauza', label: 'Pauza', group: 'events' },
  { audioKey: 'trening-zavrsen', label: 'Trening završen', group: 'events' },
  { audioKey: 'pauzirano', label: 'Pauzirano', group: 'events' },
  { audioKey: 'nastavi', label: 'Nastavi', group: 'events' },
];

export const numberPhrases = [
  { audioKey: 'jedan', label: 'Jedan', group: 'numbers', notation: '1' },
  { audioKey: 'dva', label: 'Dva', group: 'numbers', notation: '2' },
  { audioKey: 'tri', label: 'Tri', group: 'numbers', notation: '3' },
  { audioKey: 'cetiri', label: 'Četiri', group: 'numbers', notation: '4' },
  { audioKey: 'pet', label: 'Pet', group: 'numbers', notation: '5' },
  { audioKey: 'sest', label: 'Šest', group: 'numbers', notation: '6' },
];

export const actionPhrases = techniqueList.map((technique) => ({
  audioKey: technique.audioKey,
  label: technique.label,
  notation: technique.notation,
  group: technique.category,
}));

const withIds = (phrases) =>
  phrases.map((phrase) => ({
    ...phrase,
    id: phrase.audioKey,
  }));

export const requiredAudioPhrases = withIds([...eventPhrases, ...numberPhrases, ...actionPhrases]);

export const phraseGroups = [
  { id: 'events', label: 'Događaji' },
  { id: 'numbers', label: 'Brojevi' },
  { id: 'punch', label: 'Ruke' },
  { id: 'kick', label: 'Noge' },
  { id: 'defense', label: 'Odbrana' },
  { id: 'movement', label: 'Kretanje' },
  { id: 'counter', label: 'Kontre' },
];

export const phraseByAudioKey = Object.fromEntries(
  requiredAudioPhrases.map((phrase) => [phrase.audioKey, phrase])
);

export const eventLabelByAudioKey = Object.fromEntries(
  eventPhrases.map((phrase) => [phrase.audioKey, phrase.label])
);

export const numberAudioKeys = numberPhrases.map((phrase) => phrase.audioKey);

export const TEST_VOICE_TEXT =
  'Prednji direkt, zadnji direkt, zadnji low kick u prednju nogu.';
