import { useEffect, useRef, useState } from 'react';
import { paymentProvider } from '../payments';
import type { PaymentType } from '../payments';

interface Props {
  type: PaymentType;
  onSuccess: (sessionId: string) => void;
  onCancel: () => void;
}

type Phase = 'loading' | 'waiting' | 'error';

export default function PaymentSheet({ type, onSuccess, onCancel }: Props) {
  const [phase,      setPhase]      = useState<Phase>('loading');
  const [error,      setError]      = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const popupRef   = useRef<Window | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const settledRef = useRef(false); // true once session_id is found — prevents false "closed" error

  useEffect(() => {
    let cancelled = false;
    settledRef.current = false;

    const launch = async () => {
      setPhase('loading');
      setError('');

      try {
        const session = await paymentProvider.createSession(type);
        if (cancelled) return;

        const w = 480, h = 720;
        const popup = window.open(
          session.url,
          'vydryn_checkout',
          `width=${w},height=${h},left=${Math.round((screen.width-w)/2)},top=${Math.round((screen.height-h)/2)},resizable=yes,scrollbars=yes`,
        );

        // Popup blocked — do NOT navigate away (would silently destroy the recording)
        if (!popup) {
          setError('The payment window was blocked. Please allow pop-ups for this site and tap Try again.');
          setPhase('error');
          return;
        }

        popupRef.current = popup;
        setPhase('waiting');

        pollRef.current = setInterval(() => {
          // Popup closed without completing payment
          if (!popup || popup.closed) {
            clearInterval(pollRef.current!);
            if (!settledRef.current) {
              setError("The payment window was closed. Your recording is safe — tap Try again to continue.");
              setPhase('error');
            }
            return;
          }
          try {
            const sid = new URLSearchParams(new URL(popup.location.href).search).get('session_id');
            if (sid) {
              settledRef.current = true;
              clearInterval(pollRef.current!);
              popup.close();
              onSuccess(sid);
            }
          } catch { /* cross-origin while on payment provider page — expected */ }
        }, 500);

      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
          setPhase('error');
        }
      }
    };

    launch();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      popupRef.current?.close();
    };
  }, [type, onSuccess, retryCount]); // retryCount forces re-launch on retry

  const handleRetry = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    popupRef.current?.close();
    settledRef.current = false;
    setRetryCount(c => c + 1);
  };

  const label = type === 'creator' ? '€8.99/month' : '€0.99';

  return (
    <div className="ps-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="ps-sheet">
        {phase === 'loading' && <><div className="ps-spinner" /><p className="ps-title">Opening checkout…</p></>}

        {phase === 'waiting' && (
          <>
            <div className="ps-icon">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <rect x="1" y="5" width="24" height="17" rx="3" stroke="white" strokeWidth="1.5"/>
                <path d="M1 10h24" stroke="white" strokeWidth="1.5"/>
                <rect x="4" y="14" width="5" height="2.5" rx="0.8" fill="white" fillOpacity="0.45"/>
              </svg>
            </div>
            <p className="ps-title">Complete your payment</p>
            <p className="ps-body">
              Finish the <strong>{label}</strong> checkout in the window that just opened.
              Apple Pay and Google Pay are available where supported.
            </p>
            <button className="ps-cancel" onClick={onCancel}>Cancel</button>
          </>
        )}

        {phase === 'error' && (
          <>
            <p className="ps-title" style={{ color: 'var(--c-error,#ff6060)' }}>Payment unavailable</p>
            <p className="ps-body">{error}</p>
            <div className="ps-error-actions">
              <button className="ed-btn-ghost" onClick={handleRetry}>Try again</button>
              <button className="ps-cancel" onClick={onCancel}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
