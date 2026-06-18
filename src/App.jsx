import { useEffect, useMemo, useState } from 'react';
import Home from './components/Home.jsx';
import Training from './components/Training.jsx';
import Settings from './components/Settings.jsx';
import CustomCombos from './components/CustomCombos.jsx';
import AudioSetup from './components/AudioSetup.jsx';
import {
  DEFAULT_SETTINGS,
  loadCustomCombos,
  loadSettings,
  loadUseCustomCombos,
  saveCustomCombos,
  saveSettings,
  saveUseCustomCombos,
} from './utils/storage.js';
import { audioEngine } from './utils/audioEngine.js';

function CopyrightFooter() {
  return (
    <footer className="app-footer">
      © Velimir Paleksić - {' '}
      <a href="https://velimirpaleksic.com" target="_blank" rel="noreferrer">
        velimirpaleksic.com
      </a>
    </footer>
  );
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [settings, setSettings] = useState(() => loadSettings());
  const [customCombos, setCustomCombos] = useState(() => loadCustomCombos());
  const [useCustomCombos, setUseCustomCombos] = useState(() => loadUseCustomCombos());
  const [trainingId, setTrainingId] = useState(0);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveCustomCombos(customCombos);
  }, [customCombos]);

  useEffect(() => {
    saveUseCustomCombos(useCustomCombos);
  }, [useCustomCombos]);

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const startTraining = () => {
    audioEngine.configure({
      readNumbers: settings.readNumbers,
      voiceMode: settings.voiceMode,
      selectedVoiceURI: settings.selectedVoiceURI,
      voiceSpeed: settings.voiceSpeed,
    });
    audioEngine.unlock();
    setTrainingId((current) => current + 1);
    setScreen('training');
  };

  const activeCustomCombos = useMemo(() => {
    if (!useCustomCombos) return [];
    return customCombos.filter((combo) => Array.isArray(combo.steps) && combo.steps.length > 0);
  }, [customCombos, useCustomCombos]);

  return (
    <main className="min-h-dvh bg-fight-black text-white">
      <div className="app-shell">
        <div key={screen} className="screen-transition">
          {screen === 'home' && (
            <Home
              onStart={startTraining}
              onSettings={() => setScreen('settings')}
              onCustomCombos={() => setScreen('custom')}
              onAudioSetup={() => setScreen('audio')}
            />
          )}

          {screen === 'training' && (
            <Training
              key={trainingId}
              settings={settings}
              customCombos={activeCustomCombos}
              onStop={() => setScreen('home')}
            />
          )}

          {screen === 'settings' && (
            <Settings
              settings={settings}
              defaults={DEFAULT_SETTINGS}
              onChange={updateSetting}
              onBack={() => setScreen('home')}
              onAudioSetup={() => setScreen('audio')}
            />
          )}

          {screen === 'custom' && (
            <CustomCombos
              combos={customCombos}
              useCustomCombos={useCustomCombos}
              onToggleCustom={setUseCustomCombos}
              onChange={setCustomCombos}
              onBack={() => setScreen('home')}
            />
          )}

          {screen === 'audio' && <AudioSetup onBack={() => setScreen('home')} />}
        </div>
        <CopyrightFooter />
      </div>
    </main>
  );
}
