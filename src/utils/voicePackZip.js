import JSZip from 'jszip';
import { requiredAudioPhrases } from '../data/phraseList.js';
import { getClip, hasClip, listClips, saveClip } from './voiceStorage.js';

const VOICE_PACK_FILENAME = 'kombinacije-glasovni-paket.zip';
const phraseByKey = new Map(requiredAudioPhrases.map((phrase) => [phrase.audioKey, phrase]));

const extensionForMimeType = (mimeType = '') => {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
};

const getBlobDurationMs = (blob) =>
  new Promise((resolve) => {
    if (!blob || typeof Audio === 'undefined') {
      resolve(0);
      return;
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const cleanup = () => URL.revokeObjectURL(url);
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(0);
    }, 1500);

    audio.addEventListener(
      'loadedmetadata',
      () => {
        window.clearTimeout(timer);
        const durationMs = Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0;
        cleanup();
        resolve(durationMs);
      },
      { once: true }
    );

    audio.addEventListener(
      'error',
      () => {
        window.clearTimeout(timer);
        cleanup();
        resolve(0);
      },
      { once: true }
    );
  });

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportVoicePackZip = async () => {
  const clips = (await listClips()).filter((clip) => clip?.audioKey && clip?.blob?.size > 0);
  const zip = new JSZip();
  const manifest = {
    app: 'Kombinacije',
    type: 'voice-pack',
    version: 1,
    createdAt: new Date().toISOString(),
    clips: [],
  };

  for (const clip of clips) {
    const phrase = phraseByKey.get(clip.audioKey);
    if (!phrase) continue;

    const mimeType = clip.blob.type || 'audio/webm';
    const filename = `audio/${clip.audioKey}.${extensionForMimeType(mimeType)}`;
    zip.file(filename, clip.blob);
    manifest.clips.push({
      audioKey: clip.audioKey,
      label: phrase.label || clip.label || clip.audioKey,
      filename,
      mimeType,
      durationMs: await getBlobDurationMs(clip.blob),
    });
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, VOICE_PACK_FILENAME);

  return manifest.clips.length;
};

export const importVoicePackZip = async (file, { replaceExisting = false } = {}) => {
  const result = {
    found: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('ZIP nema manifest.json.');
  }

  const manifest = JSON.parse(await manifestFile.async('string'));
  if (manifest?.app !== 'Kombinacije' || manifest?.type !== 'voice-pack') {
    throw new Error('Ovo nije Kombinacije glasovni paket.');
  }

  const clips = Array.isArray(manifest.clips) ? manifest.clips : [];
  result.found = clips.length;

  for (const entry of clips) {
    const audioKey = entry?.audioKey;
    const filename = entry?.filename;
    const phrase = phraseByKey.get(audioKey);

    if (!phrase || !filename) {
      result.skipped += 1;
      continue;
    }

    const audioFile = zip.file(filename);
    if (!audioFile) {
      result.errors += 1;
      continue;
    }

    if (!replaceExisting && (await hasClip(audioKey))) {
      result.skipped += 1;
      continue;
    }

    try {
      const blob = await audioFile.async('blob');
      if (!blob?.size) {
        result.errors += 1;
        continue;
      }

      const typedBlob =
        entry.mimeType && blob.type !== entry.mimeType ? new Blob([blob], { type: entry.mimeType }) : blob;
      await saveClip(audioKey, typedBlob, phrase.label);
      result.imported += 1;
    } catch {
      result.errors += 1;
    }
  }

  return result;
};

export const getRecordedVoicePackCount = async () =>
  (await Promise.all(requiredAudioPhrases.map((phrase) => getClip(phrase.audioKey)))).filter(
    (clip) => clip?.blob?.size > 0
  ).length;
