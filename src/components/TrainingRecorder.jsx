import {
  Camera,
  Download,
  EyeOff,
  Pause,
  Play,
  Square,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const mimeTypes = [
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

const MIC_WARNING = 'Mikrofon nije dozvoljen. Snima se samo video.';

const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${rest}`;
};

const safeStopStream = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

const recordingUnsupportedError = () => new Error('recording-unsupported');

const isRecordingUnsupportedError = (error) => error?.message === 'recording-unsupported';

const getFileExtension = (mimeType) => (mimeType.includes('mp4') ? 'mp4' : 'webm');

const buildFileName = (mimeType) => {
  const date = new Date();
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  const time = [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join('-');

  return `kombinacije-trening-${stamp}-${time}.${getFileExtension(mimeType)}`;
};

const isLikelyWideOrBackCamera = (label) =>
  /wide|ultra wide|0\.5|back|rear|environment|zadnja|stražnja/i.test(label || '');

const cameraLabel = (device, index) => {
  const baseLabel = device.label || `Kamera ${index + 1}`;
  return isLikelyWideOrBackCamera(baseLabel) ? `${baseLabel} - moguće wide` : baseLabel;
};

const pickDefaultCameraId = (devices) => {
  const likelyBack = devices.find((device) => isLikelyWideOrBackCamera(device.label));
  return likelyBack?.deviceId || devices[0]?.deviceId || '';
};

const cameraConstraints = (deviceId) => {
  if (deviceId) {
    return {
      deviceId: { exact: deviceId },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    };
  }

  return {
    facingMode: 'environment',
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };
};

const requestCameraStream = async (deviceId, preferAudio = true) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Snimanje nije podržano u ovom browseru.');
  }

  const constraints = {
    video: cameraConstraints(deviceId),
    audio: preferAudio,
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { stream, warning: '' };
  } catch (error) {
    if (preferAudio) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: cameraConstraints(deviceId),
          audio: false,
        });
        return { stream, warning: MIC_WARNING };
      } catch (videoOnlyError) {
        if (deviceId) throw videoOnlyError;
      }
    }

    if (!deviceId) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: preferAudio,
        });
        return { stream, warning: '' };
      } catch (fallbackError) {
        if (preferAudio) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          return { stream, warning: MIC_WARNING };
        }

        throw fallbackError;
      }
    }

    throw error;
  }
};

export default function TrainingRecorder({
  trainingState,
  onPause,
  onResume,
  onStopTraining,
  onStopTrainingOnly,
}) {
  const [recordingState, setRecordingState] = useState('idle');
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [mediaStream, setMediaStream] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [deleteClickCount, setDeleteClickCount] = useState(0);
  const [stopPromptOpen, setStopPromptOpen] = useState(false);
  const [finishedPromptOpen, setFinishedPromptOpen] = useState(false);

  const videoRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const recordedUrlRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const stopResolveRef = useRef(null);
  const deleteResetTimeoutRef = useRef(null);
  const suppressFinishedPromptRef = useRef(false);

  const isRecording = recordingState === 'recording';
  const isStopping = recordingState === 'stopping';
  const hasActiveRecording = recordingState === 'recording' || recordingState === 'stopping';
  const canRecord =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const recordingButtonLabel = isStopping
    ? 'Zaustavlja se...'
    : isRecording
      ? 'Zaustavi snimanje'
      : 'Snimi';
  const deleteButtonLabel =
    deleteClickCount === 1
      ? 'Klikni još 2 puta za brisanje'
      : deleteClickCount === 2
        ? 'Klikni još 1 put za brisanje'
        : 'Obriši';

  useEffect(() => {
    if (!isRecording) return undefined;

    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [isRecording]);

  useEffect(() => {
    if (!videoRef.current || !mediaStream) return;

    videoRef.current.srcObject = mediaStream;
    const playPromise = videoRef.current.play?.();
    if (playPromise?.catch) {
      playPromise.catch(() => undefined);
    }
  }, [mediaStream, previewVisible]);

  useEffect(() => {
    if (trainingState !== 'finished') {
      suppressFinishedPromptRef.current = false;
      return;
    }

    if (isRecording && !suppressFinishedPromptRef.current) {
      setFinishedPromptOpen(true);
    }
  }, [isRecording, trainingState]);

  useEffect(() => {
    return () => {
      if (deleteResetTimeoutRef.current) window.clearTimeout(deleteResetTimeoutRef.current);
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
      safeStopStream(streamRef.current);
    };
  }, []);

  const resetDeleteConfirmation = useCallback(() => {
    if (deleteResetTimeoutRef.current) {
      window.clearTimeout(deleteResetTimeoutRef.current);
      deleteResetTimeoutRef.current = null;
    }
    setDeleteClickCount(0);
  }, []);

  const deleteCurrentRecording = useCallback(() => {
    if (recordedVideo?.url) {
      URL.revokeObjectURL(recordedVideo.url);
      recordedUrlRef.current = null;
    }
    resetDeleteConfirmation();
    setRecordedVideo(null);
    setStatusMessage('');
    setErrorMessage('');
    setRecordingState('idle');
  }, [recordedVideo, resetDeleteConfirmation]);

  const handleDeleteRecording = useCallback(() => {
    const nextCount = deleteClickCount + 1;

    if (deleteResetTimeoutRef.current) {
      window.clearTimeout(deleteResetTimeoutRef.current);
      deleteResetTimeoutRef.current = null;
    }

    if (nextCount >= 3) {
      deleteCurrentRecording();
      return;
    }

    setDeleteClickCount(nextCount);
    deleteResetTimeoutRef.current = window.setTimeout(() => {
      setDeleteClickCount(0);
      deleteResetTimeoutRef.current = null;
    }, 3000);
  }, [deleteClickCount, deleteCurrentRecording]);

  const handleRecorderStop = useCallback(
    (mimeType) => {
      const blobType = mimeType || recorderRef.current?.mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: blobType });
      const fileName = buildFileName(blob.type || blobType);
      const url = URL.createObjectURL(blob);

      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = url;
      safeStopStream(streamRef.current);
      streamRef.current = null;
      setMediaStream(null);
      setPreviewVisible(true);
      setRecordedVideo({ blob, fileName, url });
      setRecordingState('recorded');
      setStatusMessage('');
      setErrorMessage('');
      resetDeleteConfirmation();
      chunksRef.current = [];

      if (stopResolveRef.current) {
        stopResolveRef.current({ blob, fileName, url });
        stopResolveRef.current = null;
      }
    },
    [resetDeleteConfirmation]
  );

  const beginRecordingFromStream = useCallback(
    async (stream, warning = '') => {
      const mimeType = getSupportedMimeType();
      let recorder;

      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch (error) {
        console.warn('[recording] MediaRecorder failed:', error);
        safeStopStream(stream);
        streamRef.current = null;
        setMediaStream(null);
        setRecordingState('error');
        setErrorMessage('Snimanje nije uspjelo. Trening se nastavlja.');
        throw recordingUnsupportedError();
      }

      chunksRef.current = [];
      recorderRef.current = recorder;
      streamRef.current = stream;
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = (event) => {
        console.warn('[recording] recorder error:', event);
        setErrorMessage('Snimanje nije uspjelo. Trening se nastavlja.');
      };
      recorder.onstop = () => handleRecorderStop(mimeType || recorder.mimeType || 'video/webm');

      setMediaStream(stream);
      setRecordedVideo((current) => {
        if (current?.url) {
          URL.revokeObjectURL(current.url);
          recordedUrlRef.current = null;
        }
        return null;
      });
      setStatusMessage(warning);
      setErrorMessage('');
      setElapsedSeconds(0);
      setPreviewVisible(true);

      try {
        recorder.start();
        startedAtRef.current = Date.now();
        setRecordingState('recording');
      } catch (error) {
        console.warn('[recording] MediaRecorder start failed:', error);
        safeStopStream(stream);
        streamRef.current = null;
        setMediaStream(null);
        setRecordingState('error');
        setErrorMessage('Snimanje nije uspjelo. Trening se nastavlja.');
        throw recordingUnsupportedError();
      }
    },
    [handleRecorderStop]
  );

  const enumerateCameras = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput');
  }, []);

  const startRecording = useCallback(async () => {
    if (!canRecord) {
      setRecordingState('error');
      setErrorMessage('Snimanje nije podržano u ovom browseru.');
      return;
    }

    setRecordingState('requesting-permission');
    setStatusMessage('');
    setErrorMessage('');

    try {
      const { stream, warning } = await requestCameraStream('', true);
      const videoDevices = await enumerateCameras();

      if (videoDevices.length > 1) {
        safeStopStream(stream);
        setCameras(videoDevices);
        setSelectedCameraId(pickDefaultCameraId(videoDevices));
        setStatusMessage(warning);
        setRecordingState('selecting-camera');
        return;
      }

      await beginRecordingFromStream(stream, warning);
    } catch (error) {
      console.warn('[recording] camera permission failed:', error);
      setRecordingState('error');
      setErrorMessage(
        isRecordingUnsupportedError(error) ? 'Snimanje nije podržano u ovom browseru.' : 'Kamera nije dozvoljena.'
      );
    }
  }, [beginRecordingFromStream, canRecord, enumerateCameras]);

  const startSelectedCamera = useCallback(async () => {
    setRecordingState('requesting-permission');
    setErrorMessage('');

    try {
      const { stream, warning } = await requestCameraStream(selectedCameraId, true);
      await beginRecordingFromStream(stream, warning);
    } catch (error) {
      console.warn('[recording] selected camera failed:', error);
      if (isRecordingUnsupportedError(error)) {
        setRecordingState('error');
        setErrorMessage('Snimanje nije podržano u ovom browseru.');
        return;
      }

      setRecordingState('selecting-camera');
      setErrorMessage('Ova kamera nije dostupna. Probaj drugu kameru.');
    }
  }, [beginRecordingFromStream, selectedCameraId]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }

      stopResolveRef.current = resolve;
      setRecordingState('stopping');
      try {
        recorder.stop();
      } catch (error) {
        console.warn('[recording] stop failed:', error);
        stopResolveRef.current = null;
        safeStopStream(streamRef.current);
        streamRef.current = null;
        setMediaStream(null);
        setRecordingState('error');
        setErrorMessage('Snimanje nije uspjelo. Trening se nastavlja.');
        resolve(null);
      }
    });
  }, []);

  const cancelCameraSelection = () => {
    setRecordingState('idle');
    setCameras([]);
    setErrorMessage('');
  };

  const downloadVideo = useCallback(() => {
    if (!recordedVideo?.blob) return;
    const url = URL.createObjectURL(recordedVideo.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = recordedVideo.fileName || buildFileName(recordedVideo.blob.type || 'video/webm');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [recordedVideo]);

  const handleRecordingButton = () => {
    if (isStopping) return;

    if (isRecording) {
      void stopRecording();
      return;
    }

    void startRecording();
  };

  const handleStopTraining = () => {
    if (!hasActiveRecording) {
      onStopTraining();
      return;
    }

    setStopPromptOpen(true);
  };

  const stopTrainingAndRecording = async () => {
    setStopPromptOpen(false);
    suppressFinishedPromptRef.current = true;
    onStopTrainingOnly();
    await stopRecording();
  };

  const stopOnlyTraining = () => {
    setStopPromptOpen(false);
    suppressFinishedPromptRef.current = true;
    onStopTrainingOnly();
  };

  const stopFinishedRecording = async () => {
    setFinishedPromptOpen(false);
    suppressFinishedPromptRef.current = true;
    await stopRecording();
  };

  return (
    <>
      {(hasActiveRecording || statusMessage || errorMessage) && (
        <div className="recording-status-panel">
          {hasActiveRecording && (
            <div className="recording-live-indicator" aria-live="polite">
              <span aria-hidden="true">●</span>
              SNIMA {formatDuration(elapsedSeconds)}
            </div>
          )}
          {statusMessage && <p>{statusMessage}</p>}
          {errorMessage && <p className="recording-error">{errorMessage}</p>}
          {hasActiveRecording && !previewVisible && (
            <button className="mini-text-button" onClick={() => setPreviewVisible(true)}>
              Prikaži preview
            </button>
          )}
        </div>
      )}

      {hasActiveRecording && previewVisible && mediaStream && (
        <div className="camera-preview">
          <video ref={videoRef} muted playsInline autoPlay />
          <button className="mini-text-button" onClick={() => setPreviewVisible(false)}>
            <EyeOff aria-hidden="true" />
            Sakrij preview
          </button>
        </div>
      )}

      <div className="training-controls">
        {trainingState !== 'paused' ? (
          <button
            className="secondary-button min-h-16"
            onClick={onPause}
            disabled={trainingState === 'finished'}
          >
            <Pause aria-hidden="true" />
            Pauziraj
          </button>
        ) : (
          <button className="primary-button min-h-16" onClick={onResume}>
            <Play aria-hidden="true" />
            Nastavi
          </button>
        )}
        <button className="stop-button min-h-16" onClick={handleStopTraining}>
          <Square aria-hidden="true" />
          Stop
        </button>
        <button
          className={isRecording ? 'record-button record-button-active min-h-16' : 'record-button min-h-16'}
          onClick={handleRecordingButton}
          disabled={recordingState === 'requesting-permission' || isStopping}
        >
          <Video aria-hidden="true" />
          {recordingState === 'requesting-permission' ? 'Priprema...' : recordingButtonLabel}
        </button>
      </div>

      {recordingState === 'selecting-camera' && (
        <div className="training-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Izaberi kameru">
          <div className="training-sheet">
            <div className="sheet-title-row">
              <h2>Izaberi kameru</h2>
              <button className="mini-icon-button" onClick={cancelCameraSelection} aria-label="Odustani">
                <X aria-hidden="true" />
              </button>
            </div>
            {errorMessage && <p className="recording-error">{errorMessage}</p>}
            <div className="camera-list">
              {cameras.map((camera, index) => (
                <button
                  key={camera.deviceId || index}
                  className={
                    selectedCameraId === camera.deviceId ? 'camera-option camera-option-active' : 'camera-option'
                  }
                  onClick={() => setSelectedCameraId(camera.deviceId)}
                >
                  <Camera aria-hidden="true" />
                  {cameraLabel(camera, index)}
                </button>
              ))}
            </div>
            <div className="sheet-actions">
              <button className="primary-button" onClick={startSelectedCamera}>
                Počni snimanje
              </button>
              <button className="secondary-button" onClick={cancelCameraSelection}>
                Odustani
              </button>
            </div>
          </div>
        </div>
      )}

      {recordingState === 'recorded' && recordedVideo && (
        <div className="training-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Snimak spreman">
          <div className="training-sheet">
            <h2>Snimak spreman</h2>
            <p className="setting-description">Video je spreman za preuzimanje.</p>
            {errorMessage && <p className="recording-error">{errorMessage}</p>}
            <div className="recording-save-actions">
              <button className="primary-button" onClick={downloadVideo}>
                <Download aria-hidden="true" />
                Preuzmi video
              </button>
              <button className="danger-button" onClick={handleDeleteRecording}>
                <Trash2 aria-hidden="true" />
                {deleteButtonLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {stopPromptOpen && (
        <div className="training-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Snimanje je aktivno">
          <div className="training-sheet">
            <h2>Snimanje je aktivno. Šta želiš?</h2>
            <div className="sheet-actions">
              <button className="primary-button" onClick={stopTrainingAndRecording}>
                Zaustavi trening i snimanje
              </button>
              <button className="secondary-button" onClick={stopOnlyTraining}>
                Zaustavi samo trening
              </button>
              <button className="secondary-button" onClick={() => setStopPromptOpen(false)}>
                Odustani
              </button>
            </div>
          </div>
        </div>
      )}

      {finishedPromptOpen && (
        <div className="training-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Trening završen">
          <div className="training-sheet">
            <h2>Trening završen. Zaustaviti snimanje?</h2>
            <div className="sheet-actions">
              <button className="primary-button" onClick={stopFinishedRecording}>
                Zaustavi i sačuvaj
              </button>
              <button
                className="secondary-button"
                onClick={() => {
                  suppressFinishedPromptRef.current = true;
                  setFinishedPromptOpen(false);
                }}
              >
                Nastavi snimanje
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
