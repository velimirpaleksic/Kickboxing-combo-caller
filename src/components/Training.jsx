import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ComboDisplay from './ComboDisplay.jsx';
import TrainingRecorder from './TrainingRecorder.jsx';
import { pickCombo } from '../utils/comboGenerator.js';
import { audioEngine } from '../utils/audioEngine.js';
import { comboMemoryRecord, isValidCombo } from '../utils/comboRules.js';

const PREP_SECONDS = 3;
const TIMER_TICK_MS = 250;
const AUDIO_EVENT_TIMEOUT_MS = 1500;
const GENERATOR_WARNING = 'Premalo tehnika je uključeno za generisanje kombinacija.';

const tempoProfiles = {
  Sporo: {
    timePerActionMs: 900,
    afterVoicePauseMs: 900,
    minimumGapMs: 1600,
  },
  Normalno: {
    timePerActionMs: 700,
    afterVoicePauseMs: 600,
    minimumGapMs: 1200,
  },
  Brzo: {
    timePerActionMs: 500,
    afterVoicePauseMs: 400,
    minimumGapMs: 800,
  },
  Eksplozivno: {
    timePerActionMs: 350,
    afterVoicePauseMs: 250,
    minimumGapMs: 500,
  },
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const clampNumber = (value, fallback, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

const getTargetLength = (settings) =>
  Math.round(clampNumber(settings.strikesPerCombination, 3, 2, 6));

const getRepeatCount = (settings) =>
  Math.round(clampNumber(settings.combinationRepeats, 1, 1, 5));

const getCombinationPauseMs = (settings) =>
  Math.round(clampNumber(settings.combinationPause, 1, 0.5, 3) * 1000);

const getTempoProfile = (settings) => tempoProfiles[settings.comboTempo] || tempoProfiles.Normalno;

const getAudioTimeoutMs = (combo) =>
  Math.max(AUDIO_EVENT_TIMEOUT_MS, (combo?.steps?.length || 1) * 1800 + 1200);

const getDelayAfterVoiceMs = (settings, combo) => {
  const tempo = getTempoProfile(settings);
  return (
    tempo.afterVoicePauseMs +
    (combo?.steps?.length || 1) * tempo.timePerActionMs +
    tempo.minimumGapMs +
    getCombinationPauseMs(settings)
  );
};

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${rest}`;
};

const emptyCombo = { steps: [], notation: '' };

const stateLabel = {
  idle: 'Priprema',
  countdown: 'Priprema',
  round: 'Runda',
  paused: 'Pauzirano',
  rest: 'Pauza',
  finished: 'Završeno',
};

const safeAudio = async (label, play, timeoutMs = AUDIO_EVENT_TIMEOUT_MS) => {
  const startedAt = performance.now();

  try {
    const audioPromise = Promise.resolve()
      .then(play)
      .catch((error) => {
        console.warn('[training] audio skipped:', label, error);
        return false;
      });

    await Promise.race([audioPromise, wait(timeoutMs).then(() => false)]);
  } catch (error) {
    console.warn('[training] audio skipped:', label, error);
  }

  return Math.round(performance.now() - startedAt);
};

export default function Training({ settings, customCombos, onStop }) {
  const [trainingState, setTrainingState] = useState('countdown');
  const [round, setRound] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(PREP_SECONDS);
  const [combo, setCombo] = useState(emptyCombo);
  const [repeatIndex, setRepeatIndex] = useState(0);
  const [warningMessage, setWarningMessage] = useState('');

  const settingsRef = useRef(settings);
  const customCombosRef = useRef(customCombos);
  const recentCombosRef = useRef([]);
  const stateRef = useRef(trainingState);
  const previousStateRef = useRef('countdown');
  const roundRef = useRef(round);
  const roundElapsedMsRef = useRef(0);
  const countdownIntervalRef = useRef(null);
  const countdownStartTimeoutRef = useRef(null);
  const roundTimerRef = useRef(null);
  const restIntervalRef = useRef(null);
  const loopTokenRef = useRef(0);
  const roundExpiredRef = useRef(false);
  const hasStartedRoundRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    customCombosRef.current = customCombos;
  }, [customCombos]);

  useEffect(() => {
    stateRef.current = trainingState;
  }, [trainingState]);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  const clearCountdownTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (countdownStartTimeoutRef.current) {
      window.clearTimeout(countdownStartTimeoutRef.current);
      countdownStartTimeoutRef.current = null;
    }
  }, []);

  const clearRoundTimer = useCallback(() => {
    if (roundTimerRef.current) {
      window.clearInterval(roundTimerRef.current);
      roundTimerRef.current = null;
    }
  }, []);

  const clearRestTimers = useCallback(() => {
    if (restIntervalRef.current) {
      window.clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    clearCountdownTimers();
    clearRoundTimer();
    clearRestTimers();
  }, [clearCountdownTimers, clearRestTimers, clearRoundTimer]);

  useEffect(() => {
    audioEngine.configure({
      readNumbers: settings.readNumbers,
      voiceMode: settings.voiceMode,
      selectedVoiceURI: settings.selectedVoiceURI,
      voiceSpeed: settings.voiceSpeed,
    });
    audioEngine.unlock();
    void safeAudio('spremi-se', () => audioEngine.playEvent('spremi-se'));

    return () => {
      clearAllTimers();
      loopTokenRef.current += 1;
      audioEngine.stopAudio();
    };
  }, [
    clearAllTimers,
    settings.readNumbers,
    settings.selectedVoiceURI,
    settings.voiceMode,
    settings.voiceSpeed,
  ]);

  const resetCombo = useCallback(() => {
    setCombo(emptyCombo);
    setRepeatIndex(0);
  }, []);

  const buildCombo = useCallback((recentMemory = recentCombosRef.current) => {
    const generationSettings = {
      ...settingsRef.current,
      targetLength: getTargetLength(settingsRef.current),
    };

    for (let attempts = 0; attempts < 24; attempts += 1) {
      const nextCombo = pickCombo(generationSettings, customCombosRef.current, recentMemory);

      if (
        nextCombo?.steps?.length === generationSettings.targetLength &&
        isValidCombo(nextCombo, generationSettings, [])
      ) {
        return nextCombo;
      }
    }

    const fallbackCombo = pickCombo(generationSettings, [], []);
    return fallbackCombo?.steps?.length ? fallbackCombo : null;
  }, []);

  const playComboOnce = useCallback(async (nextCombo) => {
    return safeAudio(
      'combo',
      () =>
        audioEngine.playCombo(nextCombo.steps, {
          readNumbers: settingsRef.current.readNumbers,
        }),
      getAudioTimeoutMs(nextCombo)
    );
  }, []);

  const startRoundTimer = useCallback(() => {
    clearRoundTimer();
    roundTimerRef.current = window.setInterval(() => {
      if (stateRef.current !== 'round') return;

      roundElapsedMsRef.current += TIMER_TICK_MS;
      const roundDurationMs = settingsRef.current.roundDuration * 1000;
      const remainingMs = Math.max(0, roundDurationMs - roundElapsedMsRef.current);
      setSecondsLeft(Math.ceil(remainingMs / 1000));

      if (remainingMs <= 0) {
        roundExpiredRef.current = true;
        clearRoundTimer();
      }
    }, TIMER_TICK_MS);
  }, [clearRoundTimer]);

  const finishRound = useCallback(() => {
    if (stateRef.current !== 'round') return;

    clearRoundTimer();
    loopTokenRef.current += 1;
    hasStartedRoundRef.current = false;
    roundElapsedMsRef.current = 0;
    roundExpiredRef.current = false;
    resetCombo();

    if (roundRef.current >= settingsRef.current.rounds) {
      stateRef.current = 'finished';
      setTrainingState('finished');
      setSecondsLeft(0);
      void safeAudio('trening-zavrsen', () => audioEngine.playEvent('trening-zavrsen'));
      return;
    }

    stateRef.current = 'rest';
    setTrainingState('rest');
    setSecondsLeft(settingsRef.current.restDuration);
    void safeAudio('pauza', () => audioEngine.playEvent('pauza'));
  }, [clearRoundTimer, resetCombo]);

  const runRoundLoop = useCallback(
    async (token) => {
      await safeAudio('runda-pocinje', () => audioEngine.playEvent('runda-pocinje'));

      while (token === loopTokenRef.current && stateRef.current === 'round') {
        const nextCombo = buildCombo();

        if (!nextCombo?.steps?.length) {
          setWarningMessage(GENERATOR_WARNING);
          await wait(1000);
          if (roundExpiredRef.current) break;
          continue;
        }

        setWarningMessage('');
        recentCombosRef.current = [comboMemoryRecord(nextCombo), ...recentCombosRef.current].slice(0, 14);
        setCombo(nextCombo);

        const repeats = getRepeatCount(settingsRef.current);

        for (let repeat = 0; repeat < repeats; repeat += 1) {
          if (token !== loopTokenRef.current || stateRef.current !== 'round') return;

          setRepeatIndex(repeat);
          const voiceDurationMs = await playComboOnce(nextCombo);
          const delayMs = voiceDurationMs + getDelayAfterVoiceMs(settingsRef.current, nextCombo);
          const remainingDelayMs = Math.max(0, delayMs - voiceDurationMs);
          await wait(remainingDelayMs);

          if (roundExpiredRef.current) break;
        }

        if (roundExpiredRef.current) break;
      }

      if (token === loopTokenRef.current && stateRef.current === 'round') {
        finishRound();
      }
    },
    [buildCombo, finishRound, playComboOnce]
  );

  const beginRound = useCallback(() => {
    if (hasStartedRoundRef.current) return;
    hasStartedRoundRef.current = true;
    clearCountdownTimers();
    setWarningMessage('');
    resetCombo();

    roundElapsedMsRef.current = 0;
    roundExpiredRef.current = false;
    setSecondsLeft(settingsRef.current.roundDuration);
    stateRef.current = 'round';
    setTrainingState('round');

    const token = loopTokenRef.current + 1;
    loopTokenRef.current = token;
    startRoundTimer();
    void runRoundLoop(token);
  }, [clearCountdownTimers, resetCombo, runRoundLoop, startRoundTimer]);

  useEffect(() => {
    if (trainingState !== 'countdown') return undefined;

    clearCountdownTimers();
    countdownIntervalRef.current = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1;

        if (!countdownStartTimeoutRef.current) {
          countdownStartTimeoutRef.current = window.setTimeout(() => {
            countdownStartTimeoutRef.current = null;
            beginRound();
          }, 250);
        }

        return 0;
      });
    }, 1000);

    return clearCountdownTimers;
  }, [beginRound, clearCountdownTimers, trainingState]);

  useEffect(() => {
    if (trainingState !== 'rest') return undefined;

    clearRestTimers();
    restIntervalRef.current = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1;

        clearRestTimers();
        setRound((currentRound) => {
          const nextRound = currentRound + 1;
          roundRef.current = nextRound;
          return nextRound;
        });
        hasStartedRoundRef.current = false;
        stateRef.current = 'countdown';
        setTrainingState('countdown');
        void safeAudio('spremi-se', () => audioEngine.playEvent('spremi-se'));
        return PREP_SECONDS;
      });
    }, 1000);

    return clearRestTimers;
  }, [clearRestTimers, trainingState]);

  const pauseTraining = () => {
    if (trainingState === 'finished' || trainingState === 'paused') return;
    previousStateRef.current = trainingState;
    stateRef.current = 'paused';
    setTrainingState('paused');
    clearAllTimers();
    loopTokenRef.current += 1;
    audioEngine.pause();
    void safeAudio('pauzirano', () => audioEngine.playEvent('pauzirano'));
  };

  const resumeTraining = () => {
    if (trainingState !== 'paused') return;
    const resumeState = previousStateRef.current || 'round';
    stateRef.current = resumeState;
    setTrainingState(resumeState);
    audioEngine.resume();
    void safeAudio('nastavi', () => audioEngine.playEvent('nastavi'));

    if (resumeState === 'round') {
      const token = loopTokenRef.current + 1;
      loopTokenRef.current = token;
      startRoundTimer();
      void runRoundLoop(token);
    }

    if (resumeState === 'countdown' && secondsLeft === 0) {
      countdownStartTimeoutRef.current = window.setTimeout(beginRound, 250);
    }
  };

  const stopTrainingOnly = () => {
    clearAllTimers();
    loopTokenRef.current += 1;
    audioEngine.stopAudio();
    hasStartedRoundRef.current = false;
    roundElapsedMsRef.current = 0;
    roundExpiredRef.current = false;
    stateRef.current = 'finished';
    setTrainingState('finished');
    setSecondsLeft(0);
  };

  const stopTraining = () => {
    stopTrainingOnly();
    stateRef.current = 'idle';
    onStop();
  };

  const repeatTotal = getRepeatCount(settings);
  const statusText = stateLabel[trainingState] || stateLabel.idle;
  const displayTimer = trainingState === 'countdown' ? secondsLeft.toString() : formatTime(secondsLeft);
  const placeholder = warningMessage
    ? warningMessage
    : trainingState === 'rest'
      ? 'Pauza'
      : trainingState === 'finished'
        ? 'Trening završen'
        : 'Spremi se';
  const progressText =
    trainingState === 'round' && combo.steps.length > 0
      ? `Ponavljanje ${repeatIndex + 1} / ${repeatTotal}`
      : `Ponavljanje 0 / ${repeatTotal}`;
  const showBottomNotation =
    settings.notationDisplay === 'Na dnu ekrana' && combo.steps.length > 0 && combo.notation;

  return (
    <section className="training-screen">
      <header className="training-header">
        <div className="training-heading">
          <p className="eyebrow">RUNDA {round} / {settings.rounds}</p>
          <p className="combo-progress">{progressText}</p>
          <h1 className={trainingState === 'paused' ? 'screen-title paused-status' : 'screen-title'}>
            {statusText}
          </h1>
        </div>
        <div className="training-meta">
          <span>Način</span>
          <strong>Vreća</strong>
        </div>
      </header>

      <div className="training-main">
        <div className="timer-text">{displayTimer}</div>
        {warningMessage && <div className="warning-panel">{warningMessage}</div>}
        <ComboDisplay
          key={combo.signature || `${trainingState}-${round}-${repeatIndex}`}
          combo={combo}
          placeholder={placeholder}
          notationDisplay={settings.notationDisplay}
          animationKey={combo.signature || `${trainingState}-${round}-${repeatIndex}`}
        />
      </div>

      {showBottomNotation && <div className="notation-footer">{combo.notation}</div>}

      <TrainingRecorder
        trainingState={trainingState}
        onPause={pauseTraining}
        onResume={resumeTraining}
        onStopTraining={stopTraining}
        onStopTrainingOnly={stopTrainingOnly}
      />
    </section>
  );
}
