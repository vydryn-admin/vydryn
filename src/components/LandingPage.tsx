import { useRef, useState } from 'react';
interface Props { onFile: (file: File) => void; exiting?: boolean; isLoading?: boolean; }
export default function LandingPage({ onFile, exiting = false, isLoading = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith('audio/')) onFile(f);
  };
  return (
    <div
      className={`landing${drag ? ' landing--drag' : ''}${exiting ? ' landing--exiting' : ''}`}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
    >
      <div className="landing__vignette" />
      <div className="landing__content">
        <div className="landing__logo">
          <div className="pulse-dot" />
          <span className="vydryn-wordmark vydryn-wordmark--lg">V<span className="vy-y">Y</span>DR<span className="vy-y">Y</span>N</span>
        </div>
        <h1 className="landing__headline">Making sound visible.</h1>
        <button
          className={`landing__cta${isLoading ? ' landing__cta--loading' : ''}`}
          onClick={() => !isLoading && inputRef.current?.click()}
          aria-busy={isLoading}
        >
          {isLoading ? 'Loading…' : 'Upload Audio'}
        </button>
        <p className="landing__formats">mp3 · wav · m4a</p>
      </div>
      <input ref={inputRef} type="file" accept="audio/*" style={{ display:'none' }}
        onChange={e => handleFiles(e.target.files)} />
    </div>
  );
}
