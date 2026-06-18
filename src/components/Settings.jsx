import { ArrowLeft, Hash, Mic, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { requiredAudioPhrases } from '../data/phraseList.js';
import { audioEngine } from '../utils/audioEngine.js';
import { listClips } from '../utils/voiceStorage.js';

const roundOptions = [
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
];

const restOptions = [
  { label: '30 sek', value: 30 },
  { label: '60 sek', value: 60 },
  { label: '90 sek', value: 90 },
];

const roundCountOptions = [3, 5, 8, 10];
const strikesPerCombinationOptions = [
  { label: '2 udarca', value: 2 },
  { label: '3 udarca', value: 3 },
  { label: '4 udarca', value: 4 },
  { label: '5 udaraca', value: 5 },
  { label: '6 udaraca', value: 6 },
];
const combinationPauseOptions = [
  { label: '0.5 sekundi', value: 0.5 },
  { label: '1 sekunda', value: 1 },
  { label: '2 sekunde', value: 2 },
  { label: '3 sekunde', value: 3 },
];
const combinationRepeatOptions = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
];
const voiceSpeedOptions = ['Sporo', 'Normalno', 'Brzo', 'Vrlo brzo'];
const comboTempoOptions = ['Sporo', 'Normalno', 'Brzo', 'Eksplozivno'];
const skillLevelOptions = ['Početnik', 'Srednji', 'Napredni'];
const generatorDifficultyOptions = ['Lagan', 'Normalan', 'Težak', 'Haos, ali realan'];
const stanceOptions = ['Ortodox', 'Southpaw'];
const notationDisplayOptions = ['Sakrij', 'Ispod kombinacije', 'Na dnu ekrana'];
const comboModeOptions = [
  'Samo ruke',
  'Samo noge',
  'Ruke + low kick',
  'Ruke + svi udarci nogama',
  'Miks sa odbranom',
  'Klinč i koljena',
  'Kontra napadi',
  'Kretanje i izlazi',
];

const styleOptions = [
  'Neutralno',
  'Bokserski pritisak',
  'Kickboxing balans',
  'Low kick game',
  'Kontra stil',
  'Sovjetski stil',
  'Muay Thai stil',
];

const voiceModeOptions = [
  { label: 'Isključeno', value: 'off' },
  { label: 'Glas uređaja', value: 'device' },
  { label: 'Moj snimljeni glas', value: 'recorded' },
];

function OptionGroup({ label, description = '', options, value, onChange, columns = 2 }) {
  return (
    <div className="setting-group">
      <h2 className="field-label">{label}</h2>
      {description && <p className="setting-description">{description}</p>}
      <div className={columns === 1 ? 'option-list' : 'choice-grid'}>
        {options.map((option) => {
          const optionValue = typeof option === 'object' ? option.value : option;
          const optionLabel = typeof option === 'object' ? option.label : option;
          const active = value === optionValue;

          return (
            <button
              key={optionValue}
              className={active ? 'choice-button-active' : 'choice-button'}
              onClick={() => onChange(optionValue)}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({ label, description, enabled, onChange, icon }) {
  return (
    <div className="toggle-row">
      <div className="min-w-0">
        <h2 className="field-label">{label}</h2>
        <p className="setting-description">{description}</p>
      </div>
      <button
        className={enabled ? 'toggle-button-on' : 'toggle-button'}
        onClick={() => onChange(!enabled)}
        aria-pressed={enabled}
      >
        {icon}
        {enabled ? 'Uključeno' : 'Isključeno'}
      </button>
    </div>
  );
}

export default function Settings({ settings, onChange, onBack, onAudioSetup }) {
  const [allowedVoices, setAllowedVoices] = useState([]);
  const [recordedCount, setRecordedCount] = useState(0);
  const [voiceMessage, setVoiceMessage] = useState('');

  useEffect(() => {
    let active = true;

    const refreshVoices = async () => {
      const voices = await audioEngine.loadAllowedDeviceVoices();
      if (active) setAllowedVoices(voices);
    };

    refreshVoices();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
      return () => {
        active = false;
        window.speechSynthesis.removeEventListener?.('voiceschanged', refreshVoices);
      };
    }

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    listClips().then((clips) => {
      if (!active) return;
      const keys = new Set(clips.map((clip) => clip.audioKey));
      setRecordedCount(requiredAudioPhrases.filter((phrase) => keys.has(phrase.audioKey)).length);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      settings.voiceMode === 'device' &&
      allowedVoices.length > 0 &&
      !allowedVoices.some((voice) => voice.voiceURI === settings.selectedVoiceURI)
    ) {
      onChange('selectedVoiceURI', allowedVoices[0].voiceURI);
    }
  }, [allowedVoices, onChange, settings.selectedVoiceURI, settings.voiceMode]);

  const voiceWarning = useMemo(() => {
    if (settings.voiceMode === 'off') return '';

    if (settings.voiceMode === 'device' && allowedVoices.length === 0) {
      return 'Glas nije podešen. Na ovom uređaju nema srpskog/hrvatskog/bosanskog glasa. Koristi "Moj snimljeni glas" ili treniraj bez zvuka.';
    }

    if (settings.voiceMode === 'recorded' && recordedCount < requiredAudioPhrases.length) {
      return `Glas nije podešen. Snimljeno je ${recordedCount}/${requiredAudioPhrases.length} fraza. Nedostajuće fraze se preskaču bez zvuka.`;
    }

    return '';
  }, [allowedVoices.length, recordedCount, settings.voiceMode]);

  const testDeviceVoice = async () => {
    setVoiceMessage('');
    audioEngine.configure({
      voiceMode: 'device',
      selectedVoiceURI: settings.selectedVoiceURI,
      readNumbers: settings.readNumbers,
      voiceSpeed: settings.voiceSpeed,
    });

    const ok = await audioEngine.testVoice();
    setVoiceMessage(ok ? 'Test glasa je pušten.' : 'Nema dozvoljenog srpskog/hrvatskog/bosanskog glasa.');
  };

  return (
    <section className="screen-stack">
      <header className="screen-header">
        <button className="icon-button" onClick={onBack} aria-label="Nazad">
          <ArrowLeft aria-hidden="true" />
        </button>
        <div>
          <p className="eyebrow">Kombinacije za vreću</p>
          <h1 className="screen-title">Podešavanja</h1>
        </div>
      </header>

      <div className="settings-list">
        <div className="training-mode-panel">
          <span>Način treninga</span>
          <strong>Vreća</strong>
        </div>

        <OptionGroup
          label="Trajanje runde"
          options={roundOptions}
          value={settings.roundDuration}
          onChange={(value) => onChange('roundDuration', value)}
        />
        <OptionGroup
          label="Trajanje pauze"
          options={restOptions}
          value={settings.restDuration}
          onChange={(value) => onChange('restDuration', value)}
        />
        <OptionGroup
          label="Broj rundi"
          options={roundCountOptions}
          value={settings.rounds}
          onChange={(value) => onChange('rounds', value)}
        />
        <OptionGroup
          label="Broj udaraca po kombinaciji"
          options={strikesPerCombinationOptions}
          value={settings.strikesPerCombination}
          onChange={(value) => onChange('strikesPerCombination', value)}
        />
        <OptionGroup
          label="Pauza između kombinacija"
          options={combinationPauseOptions}
          value={settings.combinationPause}
          onChange={(value) => onChange('combinationPause', value)}
        />
        <OptionGroup
          label="Ponavljanja iste kombinacije"
          description="Koliko puta se ista kombinacija ponavlja zaredom prije nove kombinacije."
          options={combinationRepeatOptions}
          value={settings.combinationRepeats}
          onChange={(value) => onChange('combinationRepeats', value)}
        />
        <OptionGroup
          label="Brzina glasa"
          options={voiceSpeedOptions}
          value={settings.voiceSpeed}
          onChange={(value) => onChange('voiceSpeed', value)}
        />
        <OptionGroup
          label="Tempo kombinacija"
          options={comboTempoOptions}
          value={settings.comboTempo}
          onChange={(value) => onChange('comboTempo', value)}
        />
        <OptionGroup
          label="Stav"
          options={stanceOptions}
          value={settings.stance}
          onChange={(value) => onChange('stance', value)}
        />
        <OptionGroup
          label="Nivo"
          options={skillLevelOptions}
          value={settings.skillLevel}
          onChange={(value) => onChange('skillLevel', value)}
        />
        <OptionGroup
          label="Tip kombinacija"
          options={comboModeOptions}
          value={settings.comboMode}
          onChange={(value) => onChange('comboMode', value)}
          columns={1}
        />
        <OptionGroup
          label="Generator težine"
          options={generatorDifficultyOptions}
          value={settings.generatorDifficulty}
          onChange={(value) => onChange('generatorDifficulty', value)}
        />
        <OptionGroup
          label="Stil"
          options={styleOptions}
          value={settings.style}
          onChange={(value) => onChange('style', value)}
          columns={1}
        />
        <OptionGroup
          label="Prikaz notacije"
          options={notationDisplayOptions}
          value={settings.notationDisplay}
          onChange={(value) => onChange('notationDisplay', value)}
          columns={1}
        />

        <OptionGroup
          label="Glas"
          options={voiceModeOptions}
          value={settings.voiceMode}
          onChange={(value) => onChange('voiceMode', value)}
          columns={1}
        />

        {voiceWarning && <div className="warning-panel">{voiceWarning}</div>}

        {settings.voiceMode === 'device' && (
          <div className="setting-group">
            <h2 className="field-label">Glas uređaja</h2>
            {allowedVoices.length > 0 ? (
              <>
                <select
                  className="select-field"
                  value={settings.selectedVoiceURI}
                  onChange={(event) => onChange('selectedVoiceURI', event.target.value)}
                >
                  {allowedVoices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
                <button className="secondary-button min-h-14" onClick={testDeviceVoice}>
                  <Volume2 aria-hidden="true" />
                  Testiraj glas
                </button>
              </>
            ) : (
              <div className="info-panel">
                Na ovom uređaju nema srpskog/hrvatskog/bosanskog glasa. Koristi "Moj snimljeni
                glas" ili treniraj bez zvuka.
              </div>
            )}
            {voiceMessage && <p className="status-message">{voiceMessage}</p>}
          </div>
        )}

        {settings.voiceMode === 'recorded' && (
          <button className="secondary-button min-h-14" onClick={onAudioSetup}>
            <Mic aria-hidden="true" />
            Podešavanje glasa
          </button>
        )}

        {settings.voiceMode === 'off' && (
          <div className="info-panel">
            Trening je u tihom režimu. Kombinacije se prikazuju samo vizuelno.
          </div>
        )}

        <ToggleRow
          label="Čitaj brojeve"
          description={
            settings.readNumbers
              ? 'Glas čita broj prije svake tehnike.'
              : 'Glas čita samo tehniku.'
          }
          enabled={settings.readNumbers}
          onChange={(value) => onChange('readNumbers', value)}
          icon={<Hash aria-hidden="true" />}
        />

        <div className="voice-state-line">
          {settings.voiceMode === 'off' ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          <span>
            {settings.voiceMode === 'off'
              ? 'Zvuk isključen'
              : settings.voiceMode === 'device'
                ? 'Koristi se samo dozvoljen srpski/hrvatski/bosanski glas'
                : 'Koristi se moj snimljeni glas'}
          </span>
        </div>
      </div>

      <button className="secondary-button mt-auto min-h-14" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        Nazad
      </button>
    </section>
  );
}
