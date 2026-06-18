import { ArrowLeft, Download, Mic, Play, Search, Square, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { phraseGroups, requiredAudioPhrases } from '../data/phraseList.js';
import { deleteClip, getClip, listClips, saveClip } from '../utils/voiceStorage.js';
import { exportVoicePackZip, importVoicePackZip } from '../utils/voicePackZip.js';

const pickMimeType = () => {
  if (typeof window === 'undefined' || !('MediaRecorder' in window)) return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

export default function AudioSetup({ onBack }) {
  const [activeGroup, setActiveGroup] = useState('events');
  const [query, setQuery] = useState('');
  const [clipKeys, setClipKeys] = useState(new Set());
  const [recordingKey, setRecordingKey] = useState('');
  const [message, setMessage] = useState('');
  const [importMode, setImportMode] = useState('skip');
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const importInputRef = useRef(null);

  const supported =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof window !== 'undefined' &&
    'MediaRecorder' in window;

  const refreshClips = async () => {
    const clips = await listClips();
    setClipKeys(new Set(clips.map((clip) => clip.audioKey)));
  };

  useEffect(() => {
    refreshClips();

    const onMissingAudio = () => refreshClips();
    window.addEventListener('kombinacije:missing-audio', onMissingAudio);

    return () => {
      window.removeEventListener('kombinacije:missing-audio', onMissingAudio);
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const visiblePhrases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return requiredAudioPhrases.filter((phrase) => {
      const matchesGroup = phrase.group === activeGroup;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        phrase.label.toLowerCase().includes(normalizedQuery) ||
        phrase.audioKey.toLowerCase().includes(normalizedQuery) ||
        phrase.notation?.toLowerCase().includes(normalizedQuery);

      return matchesGroup && matchesQuery;
    });
  }, [activeGroup, query]);

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  const startRecording = async (phrase) => {
    if (!supported) {
      setMessage('Snimanje nije dostupno u ovom browseru.');
      return;
    }

    if (recordingKey) {
      stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecordingKey('');

        if (blob.size === 0) {
          setMessage('Snimak je prazan. Probaj ponovo.');
          return;
        }

        await saveClip(phrase.audioKey, blob, phrase.label);
        await refreshClips();
        setMessage(`Snimljeno: ${phrase.label}`);
      };

      recorder.start();
      setRecordingKey(phrase.audioKey);
      setMessage(`Snimanje: ${phrase.label}`);
    } catch {
      setRecordingKey('');
      setMessage('Browser nije dozvolio mikrofon.');
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const playRecording = async (phrase) => {
    const clip = await getClip(phrase.audioKey);

    if (!clip?.blob) {
      setMessage('Nije snimljeno.');
      return;
    }

    const url = URL.createObjectURL(clip.blob);
    const audio = new Audio(url);

    try {
      await audio.play();
      await new Promise((resolve) => {
        audio.addEventListener('ended', resolve, { once: true });
        audio.addEventListener('error', resolve, { once: true });
      });
      setMessage(`Preslušano: ${phrase.label}`);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const removeRecording = async (phrase) => {
    await deleteClip(phrase.audioKey);
    await refreshClips();
    setMessage(`Obrisano: ${phrase.label}`);
  };

  const exportVoicePack = async () => {
    try {
      const exportedCount = await exportVoicePackZip();
      setMessage(`Izvezeno: ${exportedCount} fraza.`);
    } catch {
      setMessage('Izvoz nije uspio.');
    }
  };

  const importVoicePack = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    try {
      const result = await importVoicePackZip(file, {
        replaceExisting: importMode === 'replace',
      });
      await refreshClips();
      setMessage(`Uvezeno: ${result.imported}. Preskočeno: ${result.skipped}. Greške: ${result.errors}.`);
    } catch (error) {
      setMessage(error?.message || 'Uvoz nije uspio.');
    }
  };

  const recordedCount = clipKeys.size;
  const totalCount = requiredAudioPhrases.length;

  return (
    <section className="screen-stack">
      <header className="screen-header">
        <button className="icon-button" onClick={onBack} aria-label="Nazad">
          <ArrowLeft aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <p className="eyebrow">Glas</p>
          <h1 className="screen-title">Podešavanje glasa</h1>
        </div>
      </header>

      <div className="info-panel">
        Snimi fraze svojim glasom. Klipovi ostaju samo u ovom browseru i čuvaju se u IndexedDB.
      </div>

      <div className="recording-progress">
        <span>Snimljeno</span>
        <strong>
          {recordedCount}/{totalCount}
        </strong>
      </div>

      <div className="setting-group">
        <div className="split-row">
          <div>
            <h2 className="field-label">Glasovni paket</h2>
            <p className="setting-description">
              Snimljeno: {recordedCount} / {totalCount} fraza
            </p>
          </div>
        </div>

        <div className="choice-grid">
          <button
            className={importMode === 'skip' ? 'choice-button-active' : 'choice-button'}
            onClick={() => setImportMode('skip')}
          >
            Preskoči postojeće
          </button>
          <button
            className={importMode === 'replace' ? 'choice-button-active' : 'choice-button'}
            onClick={() => setImportMode('replace')}
          >
            Zamijeni postojeće
          </button>
        </div>

        <div className="home-action-grid">
          <button className="secondary-button min-h-14" onClick={exportVoicePack}>
            <Download aria-hidden="true" />
            Izvezi glasove
          </button>
          <button className="secondary-button min-h-14" onClick={() => importInputRef.current?.click()}>
            <Upload aria-hidden="true" />
            Uvezi glasove
          </button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".zip,application/zip"
          className="sr-only"
          onChange={importVoicePack}
        />
      </div>

      {!supported && (
        <div className="warning-panel">
          Ovaj browser ne podržava snimanje kroz MediaRecorder.
        </div>
      )}

      <label className="search-field">
        <Search aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pretraži fraze"
        />
      </label>

      <div className="choice-grid">
        {phraseGroups.map((group) => (
          <button
            key={group.id}
            className={activeGroup === group.id ? 'choice-button-active' : 'choice-button'}
            onClick={() => setActiveGroup(group.id)}
          >
            {group.label}
          </button>
        ))}
      </div>

      {message && <p className="status-message">{message}</p>}

      <div className="recording-list">
        {visiblePhrases.map((phrase) => {
          const hasRecording = clipKeys.has(phrase.audioKey);
          const isRecording = recordingKey === phrase.audioKey;

          return (
            <article
              className={hasRecording ? 'recording-row' : 'recording-row missing-recording'}
              key={phrase.audioKey}
            >
              <div className="recording-copy">
                <div className="recording-title-line">
                  {phrase.notation && <span className="recording-notation">{phrase.notation}</span>}
                  <h2 className="recording-label">{phrase.label}</h2>
                </div>
                <p className={hasRecording ? 'recording-status done' : 'recording-status'}>
                  {hasRecording ? 'Snimljeno' : 'Nije snimljeno'}
                </p>
              </div>

              <div className="recording-actions">
                <button
                  className={isRecording ? 'mini-text-button danger-mini' : 'mini-text-button'}
                  onClick={() => (isRecording ? stopRecording() : startRecording(phrase))}
                  disabled={!supported && !isRecording}
                >
                  {isRecording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
                  {isRecording ? 'Stop' : 'Snimi'}
                </button>
                <button
                  className="mini-text-button"
                  onClick={() => playRecording(phrase)}
                  disabled={!hasRecording}
                >
                  <Play aria-hidden="true" />
                  Preslušaj
                </button>
                <button
                  className="mini-text-button danger-mini"
                  onClick={() => removeRecording(phrase)}
                  disabled={!hasRecording}
                >
                  <Trash2 aria-hidden="true" />
                  Obriši
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <button className="secondary-button mt-auto min-h-14" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        Nazad
      </button>
    </section>
  );
}
