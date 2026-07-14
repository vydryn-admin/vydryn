import { useEffect, useMemo, useRef, useState } from 'react';
import { paymentProvider } from '../payments';
import type { PaymentType } from '../payments';
import { Recorder, type RecordingResult } from '../engine/Recorder';
import PaymentSheet from './PaymentSheet';

interface Props {
  recording: RecordingResult;
  snapshot:  string | null;
  onClose:   () => void;
  onActivateCreator: () => void;
  onExportClean:   (durationMs: number) => Promise<Blob>;
  autoDownload?: boolean; // creator: download immediately after the ready moment
}

type Phase = 'ready' | 'choose' | 'payment' | 'preparing' | 'done';

const PREPARING_MESSAGES = [
  'Reading your audio…',
  'Rendering frames…',
  'Almost ready…',
  'Finishing up…',
];

export default function ExportDialog({ recording, snapshot, onClose, onActivateCreator, onExportClean, autoDownload = false }: Props) {
  const [phase,     setPhase]    = useState<Phase>('ready');
  const [payType,   setPayType]  = useState<PaymentType | null>(null);
  const [progress,  setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const preparingMsg = useMemo(() => {
    if (progress < 28) return PREPARING_MESSAGES[0];
    if (progress < 60) return PREPARING_MESSAGES[1];
    if (progress < 90) return PREPARING_MESSAGES[2];
    return PREPARING_MESSAGES[3];
  }, [progress]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') {
        if (phase === 'ready') setPhase('choose');
        else if (phase === 'choose') handleClose();
      } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Breath: all creators see "Your visual is ready." for 750ms
  // Creator (autoDownload): then download starts automatically, dialog closes
  // Free user: then options appear
  useEffect(() => {
    if (phase !== 'ready') return;
    const t = setTimeout(() => {
      if (autoDownload) {
        try {
          window.dispatchEvent(new CustomEvent('vydryn:moment'));
          Recorder.download(recording.blob, 'vydryn-clean');
          setPhase('done');
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(handleClose, 700);
        } catch {
          setPhase('choose'); // fallback: show options if download fails
        }
      } else {
        setPhase('choose');
      }
    }, 750);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Breath before close: dialog inhales (dims) before unmounting
  const handleClose = () => {
    if (isExiting) return;
    setIsExiting(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsExiting(false);
      onClose();
    }, 200);
  };

  const downloadFree = () => {
    window.dispatchEvent(new CustomEvent('vydryn:moment'));
    Recorder.download(recording.blob, 'vydryn-watermarked');
    // Brief success state — the creation moment deserves an ending
    setPhase('done');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(handleClose, 700);
  };

  const handlePaymentSuccess = async (sessionId: string) => {
    setPhase('preparing');
    setProgress(0);

    try {
      const result = await paymentProvider.verifySession(sessionId);
      if (!result.paid) { setPhase('choose'); return; }
      if (result.type === 'creator' || payType === 'creator') onActivateCreator();
    } catch { /* proceed — user completed payment via the active provider */ }

    const dur = recording.durationMs;
    let elapsed = 0;
    const iv = setInterval(() => {
      elapsed += 80;
      setProgress(Math.min(97, (elapsed / dur) * 100));
    }, 80);

    try {
      const cleanBlob = await onExportClean(dur);
      clearInterval(iv);
      setProgress(100);
      timerRef.current = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('vydryn:moment'));
        Recorder.download(cleanBlob, 'vydryn-clean');
        setPhase('done');
        timerRef.current = setTimeout(handleClose, 800);
      }, 400);
    } catch {
      clearInterval(iv);
      setPhase('choose');
    }
  };

  return (
    <>
      <div className={`ed-backdrop${isExiting ? ' ed-backdrop--exiting' : ''}`} onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          if (phase === 'ready') setPhase('choose');    // skip the breath
          else if (phase === 'choose') handleClose();
        }}>
        <div className={`ed-card${isExiting ? ' ed-card--exiting' : ''}`} role="dialog" aria-modal>

          {/* Ready — creator sees completion before the download decision */}
          {phase === 'ready' && (
            <div className="ed-ready">
              <h2 className="ed-title ed-title--ready">Your visual is ready.</h2>
            </div>
          )}

          {/* ── Preparing ── */}
          {phase === 'preparing' && (
            <div className="ed-center">
              <div className="ed-progress-ring">
                <svg viewBox="0 0 52 52" className="ed-ring-svg">
                  <circle className="ed-ring-bg" cx="26" cy="26" r="22"/>
                  <circle className="ed-ring-fill" cx="26" cy="26" r="22"
                    style={{ strokeDashoffset: 138.2 - (138.2 * progress / 100) }}/>
                </svg>
                <span className="ed-ring-pct">{Math.round(progress)}%</span>
              </div>
              <p className="ed-title" style={{ marginTop: 18 }}>Preparing your visual…</p>
              <p className="ed-sub ed-sub--anim">{preparingMsg}</p>
            </div>
          )}

          {/* ── Done ── */}
          {phase === 'done' && (
            <div className="ed-center ed-center--done">
              <div className="ed-check">✓</div>
              <p className="ed-title">Your visual is ready.</p>
              <p className="ed-sub">Your download has started.</p>
            </div>
          )}

          {/* ── Choose ── */}
          {phase === 'choose' && (
            <div className="ed-options">
              {snapshot && (
                <div className="ed-thumb-wrap">
                  <img className="ed-thumb" src={snapshot} alt="Visual preview" />
                </div>
              )}

              <h2 className="ed-title">Your visual is ready.</h2>
              <p className="ed-sub">Choose how you'd like to download it.</p>

              <div className="ed-option">
                <div className="ed-option-meta">
                  <span className="ed-price">Free</span>
                  <span className="ed-option-name">Download with watermark</span>
                  <span className="ed-option-fine">{(()=>{
                    const ext = recording.mimeType.includes('mp4') ? 'mp4' : 'webm';
                    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
                    if (ext === 'mp4') return 'mp4 · plays on all devices';
                    if (isIOS) return 'webm · convert in CapCut to play on iPhone';
                    return 'webm · convert in CapCut or DaVinci if needed';
                  })()}</span>
                </div>
                <button className="ed-btn-ghost" onClick={downloadFree}>Download</button>
              </div>

              <div className="ed-rule" />

              <div className="ed-option ed-option-featured">
                <div className="ed-option-meta">
                  <span className="ed-price ed-price-accent">€0.99</span>
                  <span className="ed-option-name">Remove watermark</span>
                  <span className="ed-option-fine">One-time · this visual only</span>
                </div>
                <button className="ed-btn-primary"
                  onClick={() => { setPayType('unlock'); setPhase('payment'); }}>
                  Remove watermark
                </button>
              </div>

              <div className="ed-rule" />

              <div className="ed-option">
                <div className="ed-option-meta">
                  <span className="ed-price">€8.99 <span className="ed-price-mo">/ month</span></span>
                  <span className="ed-option-name">Creator</span>
                  <span className="ed-option-fine">Unlimited watermark-free exports</span>
                </div>
                <button className="ed-btn-ghost"
                  onClick={() => { setPayType('creator'); setPhase('payment'); }}>
                  Become a Creator
                </button>
              </div>

              <button className="ed-close" onClick={handleClose} aria-label="Close">×</button>
            </div>
          )}
        </div>
      </div>

      {phase === 'payment' && payType && (
        <PaymentSheet type={payType} onSuccess={handlePaymentSuccess} onCancel={() => setPhase('choose')} />
      )}
    </>
  );
}
