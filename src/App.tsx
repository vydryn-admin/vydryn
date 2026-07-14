import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AudioFeatures, Settings, DEFAULT_SETTINGS,
  THEMES, STYLES, STYLE_THEMES,
  PRIMARY_CONTROLS, ADVANCED_CONTROLS,
  FORMAT_DIMS, FORMAT_LABELS,
} from './types'
import { AudioEngine, MAX_AUDIO_BYTES } from './engine/AudioEngine'
import { CanvasRenderer } from './engine/CanvasRenderer'
import { VoidPlasmaGL }   from './engine/VoidPlasmaGL'
import { Recorder, type RecordingResult } from './engine/Recorder'
import { Watermark }      from './engine/Watermark'
import { useCreatorStatus } from './hooks/useCreatorStatus'
import LandingPage  from './components/LandingPage'
import ExportDialog from './components/ExportDialog'
import StylePreviews from './components/StylePreviews'

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef  = useRef<HTMLDivElement>(null)
  const audioRef  = useRef<HTMLAudioElement>(null)

  const audioEngine = useRef(new AudioEngine())
  const renderer    = useRef<CanvasRenderer | null>(null)
  const voidGL      = useRef<VoidPlasmaGL | null>(null)
  const recorder     = useRef(new Recorder())
  const recIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const modeRef      = useRef('plasma')
  const themeRef     = useRef(0)
  const settingsRef  = useRef<Settings>({ ...DEFAULT_SETTINGS })
  const watermarkRef = useRef(false)
  const isRecordRef  = useRef(false)

  const [mode,          setMode]          = useState('plasma')
  const [theme,         setTheme]         = useState(0)
  const [format,        setFormat]        = useState('916')
  const [settings,      setSettings]      = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [isPlaying,     setIsPlaying]     = useState(false)
  const [isMuted,       setIsMuted]       = useState(false)
  const [isRecording,   setIsRecording]   = useState(false)
  const [isLoadingAudio,setIsLoadingAudio] = useState(false)
  const [recSeconds,    setRecSeconds]     = useState(0)
  const [appError,      setAppError]       = useState<string | null>(null)
  const [hasAudio,      setHasAudio]      = useState(false)
  const [trackName,     setTrackName]     = useState('')
  const [currentTime,   setCurrentTime]   = useState(0)
  const [duration,      setDuration]      = useState(0)
  const [showAdvanced,  setShowAdvanced]  = useState(false)
  const [activeCtrl,    setActiveCtrl]    = useState<string | null>(null)
  const ctrlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [userPicked,    setUserPicked]    = useState(false) // has user manually chosen a colour?

  const [exportResult,   setExportResult]   = useState<RecordingResult | null>(null)
  const [exportSnapshot, setExportSnapshot] = useState<string | null>(null)
  const [showExport,     setShowExport]     = useState(false)

  const [showLanding, setShowLanding] = useState(true)
  const { isCreator, activate: activateCreator } = useCreatorStatus()

  // Payment return
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const sid  = p.get('session_id')
    const type = p.get('payment_type')
    if (sid && type && window.opener) {
      window.opener.postMessage({ type: 'vydryn_payment_success', sessionId: sid, paymentType: type }, window.location.origin)
      window.close()
    }
  }, [])


  // Brand behaviour: dot acknowledgement system
  useEffect(() => {
    const ack = () => {
      // Instrument heartbeat (pulse dot)
      document.querySelectorAll<HTMLElement>('.pulse-dot').forEach(dot => {
        dot.classList.remove('pulse-dot--acknowledge');
        void dot.offsetWidth;
        dot.classList.add('pulse-dot--acknowledge');
      });
      setTimeout(() => {
        document.querySelectorAll('.pulse-dot')
          .forEach(d => d.classList.remove('pulse-dot--acknowledge'));
      }, 145);
      // Brand signature — Y letterforms illuminate briefly
      document.querySelectorAll<HTMLElement>('.vydryn-wordmark').forEach(el => {
        el.classList.remove('vydryn-resonance');
        void el.offsetWidth;
        el.classList.add('vydryn-resonance');
      });
      setTimeout(() => {
        document.querySelectorAll('.vydryn-wordmark')
          .forEach(el => el.classList.remove('vydryn-resonance'));
      }, 150);
    };
    window.addEventListener('vydryn:moment', ack);
    // Suspend AudioContext when tab hidden — saves battery and CPU
    const onVisibility = () => audioEngine.current.handleVisibilityChange();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('vydryn:moment', ack);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  const moment = () => window.dispatchEvent(new CustomEvent('vydryn:moment'));

  // Physical brightness confirmation — the canvas acknowledges meaningful switches
  const flashCanvas = (intensity = 1.6, ms = 80) => {
    const c = canvasRef.current; if (!c) return;
    c.style.transition = `filter ${ms}ms ease-out`;
    c.style.filter = `brightness(${intensity})`;
    setTimeout(() => {
      c.style.filter = 'brightness(1)';
      setTimeout(() => { c.style.filter = ''; c.style.transition = ''; }, ms + 60);
    }, ms);
  };

  // Sync refs
  const updateMode = (m: string) => {
    // Breath: 40ms pause lets the card-press register before the world changes
    flashCanvas(1.4, 70) // visual click: the inhale
    setTimeout(() => {
      modeRef.current = m
      setMode(m)         // exhale: world changes
    }, 40)
    moment()            // VYDRYN acknowledges: style chosen
    // Auto-set colour when style changes, unless user has manually picked one
    if (!userPicked) {
      const auto = STYLE_THEMES[m] ?? 0
      themeRef.current = auto
      setTheme(auto)
    }
  }
  const updateTheme = (t: number) => {
    themeRef.current = t; setTheme(t); setUserPicked(true)
  }
  const updateSetting = (k: keyof Settings, v: number) => {
    settingsRef.current = { ...settingsRef.current, [k]: v }
    setSettings({ ...settingsRef.current })
  }

  // Show numeric value only while the slider is active — the canvas IS the readout
  const handleCtrlChange = (k: keyof Settings, v: number) => {
    updateSetting(k, v)
    setActiveCtrl(k)
    if (ctrlTimerRef.current) clearTimeout(ctrlTimerRef.current)
    ctrlTimerRef.current = setTimeout(() => setActiveCtrl(null), 700)
  }

  const applySize = useCallback(() => {
    const canvas = canvasRef.current; const frame = frameRef.current
    if (!canvas) return
    if (!hasAudio) {
      canvas.width = window.innerWidth; canvas.height = window.innerHeight
      if (frame) { frame.style.width='100%'; frame.style.height='100%' }
      voidGL.current?.resize(canvas.width, canvas.height)
      return
    }
    const [w,h] = FORMAT_DIMS[format] ?? [1080,1920]
    canvas.width = w; canvas.height = h; voidGL.current?.resize(w,h)
    if (!frame) return
    const maxW = window.innerWidth-(window.innerWidth>900?380:80), maxH=window.innerHeight-48
    let dw=maxW, dh=dw/(w/h); if(dh>maxH){dh=maxH;dw=dh*(w/h)}
    frame.style.width=`${dw}px`; frame.style.height=`${dh}px`
  }, [hasAudio, format])

  useEffect(() => { applySize(); window.addEventListener('resize',applySize); return()=>window.removeEventListener('resize',applySize) }, [applySize])

  useEffect(() => {
    if (!canvasRef.current) return
    renderer.current = new CanvasRenderer(canvasRef.current)
    try { voidGL.current = new VoidPlasmaGL() } catch { /* WebGL2 unavailable */ }
    return () => {
      // Release AudioContext and object URLs on unmount
      audioEngine.current.destroy();
      if (recIntervalRef.current) clearInterval(recIntervalRef.current);
    };
  }, [])

  useEffect(() => {
    let rafId: number, beatPhase=0, prevKick=0, beatRingActive=false, tick=0
    const frame = (ts: number) => {
      const fx: AudioFeatures = audioEngine.current.update(ts)
      if(fx.kick>0.38&&prevKick<=0.38){beatPhase=0;beatRingActive=true}
      prevKick=fx.kick
      if(beatRingActive){beatPhase=Math.min(1,beatPhase+0.027);if(beatPhase>=1)beatRingActive=false}
      const m=modeRef.current, canvas=canvasRef.current
      if(m==='void'&&voidGL.current&&canvas)
        voidGL.current.render(canvas,fx,ts/1000,settingsRef.current,themeRef.current,beatPhase)
      else if(renderer.current)
        renderer.current.render(fx,ts/1000,settingsRef.current,m,themeRef.current)
      if(watermarkRef.current&&isRecordRef.current&&canvas){
        const ctx=canvas.getContext('2d'); if(ctx)Watermark.draw(ctx,canvas.width,canvas.height)
      }
      if(++tick%4===0){const el=audioRef.current;if(el?.duration)setCurrentTime(el.currentTime)}
      rafId=requestAnimationFrame(frame)
    }
    rafId=requestAnimationFrame(frame)
    return()=>cancelAnimationFrame(rafId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadFile = useCallback((file: File) => {
    const el = audioRef.current!
    setAppError(null)
    setIsLoadingAudio(true)
    if(!audioEngine.current.isInitialized) audioEngine.current.init(el)
    const loadErr = audioEngine.current.loadFile(el, file)
    if (loadErr) { setIsLoadingAudio(false); setAppError(loadErr); return; }
    setTrackName(file.name.replace(/\.[^/.]+$/,''))
    el.onloadedmetadata=()=>{
      setIsLoadingAudio(false)
      setDuration(el.duration)
      setHasAudio(true)
      setTimeout(()=>setShowLanding(false), 360)  // landing inhales and exits
      moment()            // VYDRYN acknowledges: audio is ready
      setTimeout(()=>flashCanvas(2.2, 110), 460)  // silence (360+100ms) → canvas exhales
    }
    el.onerror=()=>{ setIsLoadingAudio(false); setAppError('Could not read this audio file.'); }
    el.onended=()=>setIsPlaying(false)
    el.play().then(()=>{audioEngine.current.resume();setIsPlaying(true)}).catch(()=>{})
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { if(e.target.files?.[0])loadFile(e.target.files[0]) }
  const handleDragOver  = (e: React.DragEvent) => e.preventDefault()
  const handleDrop      = (e: React.DragEvent) => { e.preventDefault();if(e.dataTransfer.files[0])loadFile(e.dataTransfer.files[0]) }
  const handlePlay      = () => { const el=audioRef.current!;audioEngine.current.resume();if(el.paused){el.play();setIsPlaying(true)}else{el.pause();setIsPlaying(false)} }
  const handleRestart   = () => { const el=audioRef.current!;el.currentTime=0;el.play();setIsPlaying(true) }
  const handleMute      = () => { const el=audioRef.current!;el.muted=!el.muted;setIsMuted(el.muted) }
  const handleSeek      = (e: React.ChangeEvent<HTMLInputElement>) => { const el=audioRef.current!;if(el.duration)el.currentTime=(parseFloat(e.target.value)/1000)*el.duration }

  const handleExport = () => {
    const canvas=canvasRef.current!, audioEl=audioRef.current!
    if(recorder.current.isActive){
      // Stop first — snapshot is captured inside onComplete after blob resolves
      recorder.current.stop()
      if(recIntervalRef.current){clearInterval(recIntervalRef.current);recIntervalRef.current=null}
      setIsRecording(false); isRecordRef.current=false; watermarkRef.current=false
      moment()            // VYDRYN acknowledges: recording captured
    } else {
      watermarkRef.current=!isCreator; isRecordRef.current=true; setIsRecording(true)
      setRecSeconds(0)
      recIntervalRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
      recorder.current.start(
        canvas,
        audioEngine.current.mediaStream,
        audioEl.currentTime,
        (result:RecordingResult)=>{
          // Snapshot taken here — after recording has fully resolved, not before stop()
          const snap = canvasRef.current?.toDataURL('image/jpeg', 0.55) ?? null
          setExportSnapshot(snap)
          setExportResult(result)
          setShowExport(true) // always show dialog — creator gets premium moment too
        },
        (err:Error)=>{
          if(recIntervalRef.current){clearInterval(recIntervalRef.current);recIntervalRef.current=null}
          setIsRecording(false); isRecordRef.current=false; watermarkRef.current=false
          setAppError(err.message)
        }
      )
    }
  }

  const handleExportClean = (durationMs: number): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
      const canvas  = canvasRef.current
      const audioEl = audioRef.current
      if (!canvas || !audioEl) {
        reject(new Error('Export context unavailable. Please try again.'))
        return
      }

      // settled: prevents double-cleanup if both timers and onComplete race
      let settled = false
      let stopTimer:  ReturnType<typeof setTimeout> | null = null
      let failTimer:  ReturnType<typeof setTimeout> | null = null
      const tmp = new Recorder()

      // cleanup: called exactly once on every exit path
      const cleanup = (err?: Error) => {
        if (settled) return
        settled = true
        if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
        if (failTimer) { clearTimeout(failTimer); failTimer = null }
        isRecordRef.current  = false
        watermarkRef.current = false
        try { audioEl.pause() } catch { /* already unloaded */ }
        if (err) reject(err)
      }

      if (exportResult) audioEl.currentTime = exportResult.audioStartTime
      audioEl.play().catch(() => {})
      watermarkRef.current = false
      isRecordRef.current  = true

      tmp.start(
        canvas,
        audioEngine.current.mediaStream,
        audioEl.currentTime,
        (result) => { cleanup(); resolve(result.blob) },
        (err)    => { if (tmp.isActive) tmp.stop(); cleanup(err) }
      )

      // Stop after expected duration + buffer (triggers onstop → onComplete)
      stopTimer = setTimeout(() => { if (tmp.isActive) tmp.stop() }, durationMs + 300)

      // Hard safety net — resets all state if everything goes wrong
      failTimer = setTimeout(() => {
        if (tmp.isActive) tmp.stop()
        cleanup(new Error('Export timed out. Please try again.'))
      }, durationMs + 15_000)
    })
  }

  const seekValue = duration>0?Math.round((currentTime/duration)*1000):0

  return (
    <div className={`app${hasAudio?' app--studio':' app--landing'}`}>

      <main className="stage" role="main">
        <div className={`frame${hasAudio?'':' frame--landing'}`} ref={frameRef}>
          <canvas ref={canvasRef} role="img" aria-label="Audio-reactive visual" />
          {hasAudio && (
            <div className="hud">
              <div className="hud-brand"><div className="pulse-dot pulse-dot--sm"/></div>
              {isRecording && <div className="hud-status hud-status--rec">● {fmtTime(recSeconds)}</div>}
            </div>
          )}
          {hasAudio && (
            <label className="drop-zone" onDragOver={handleDragOver} onDrop={handleDrop}>
              {trackName || 'Drop audio or click to upload'}
              <input className="file-input" type="file" accept="audio/*" onChange={handleFileInput}/>
            </label>
          )}
        </div>
      </main>

      {showLanding && <LandingPage onFile={loadFile} exiting={hasAudio} isLoading={isLoadingAudio}/>}

      {hasAudio && (
        <aside className="panel" aria-label="Controls">

          {/* Brand */}
          <div className="panel-brand">
            <div className="pulse-dot"/>
            <span className="vydryn-wordmark">V<span className="vy-y">Y</span>DR<span className="vy-y">Y</span>N</span>
          </div>

          {/* Style — live animated previews */}
          <section className="panel-section">
            <div className="style-grid">
              <StylePreviews activeStyle={mode} onSelect={updateMode} />
            </div>
          </section>

          {/* Intensity — single primary control */}
          <section className="panel-section">
            {PRIMARY_CONTROLS.map(([key,label,min,max])=>(
              <div key={key} className={`ctrl ctrl--primary${activeCtrl===key?' ctrl--active':''}`}>
                <label className="ctrl-label">{label}<output className={`ctrl-value${activeCtrl===key?' ctrl-value--visible':''}`}>{settings[key].toFixed(2)}</output></label>
                <input type="range" min={min} max={max} step={0.01} value={settings[key]}
                  onChange={e=>handleCtrlChange(key,parseFloat(e.target.value))}/>
              </div>
            ))}
          </section>

          {/* Format */}
          <section className="panel-section">
            <div className="btn-group">
              {Object.entries(FORMAT_LABELS).map(([id,lbl])=>(
                <button key={id} className={`btn-fmt${format===id?' btn-fmt--active':''}`}
                  onClick={()=>setFormat(id)}>{lbl}</button>
              ))}
            </div>
          </section>

          {/* Transport */}
          <section className="panel-section">
            <div className="track-name">{trackName}</div>
            <div className="transport">
              <button className="transport-btn transport-btn--primary" onClick={handlePlay}>
                {isPlaying?'⏸':'▶'}
              </button>
              <button className="transport-btn" onClick={handleRestart}>⟳</button>
              <button className="transport-btn" onClick={handleMute}>(isMuted
                ? <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5.5h2.5L7 3v8l-2.5-2.5H2V5.5z"/><line x1="9.5" y1="5" x2="12.5" y2="9"/><line x1="12.5" y1="5" x2="9.5" y2="9"/></svg>
                : <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5.5h2.5L7 3v8l-2.5-2.5H2V5.5z"/><path d="M8.5 5.5q1 .8 1 1.5t-1 1.5"/><path d="M10.2 4q1.8 1.4 1.8 3t-1.8 3"/></svg>
                )</button>
            </div>
            <div className="seek-row">
              <span className="seek-time">{fmtTime(currentTime)}</span>
              <input type="range" min={0} max={1000} value={seekValue} onChange={handleSeek} className="seek-bar"/>
              <span className="seek-time">{fmtTime(duration)}</span>
            </div>
          </section>

          {/* Advanced — collapsed by default */}
          <section className="panel-section">
            <button className="advanced-toggle" onClick={()=>setShowAdvanced(v=>!v)}>
              {showAdvanced?'− More':'+ More'}
            </button>
            {showAdvanced && (
              <div className="advanced-controls">
                {/* Colour in Advanced */}
                <div className="ctrl">
                  <label className="ctrl-label">Color</label>
                  <div className="swatch-row" style={{marginTop:6}}>
                    {THEMES.map((t,i)=>(
                      <button key={i} className={`swatch${theme===i?' swatch--active':''}`}
                        style={{background:`linear-gradient(135deg,${t.join(',')})`}}
                        onClick={()=>updateTheme(i)} aria-label={`Color ${i+1}`}/>
                    ))}
                  </div>
                </div>
                {ADVANCED_CONTROLS.map(([key,label,min,max])=>(
                  <div key={key} className={`ctrl${activeCtrl===key?' ctrl--active':''}`}>
                    <label className="ctrl-label">{label}<output className={`ctrl-value${activeCtrl===key?' ctrl-value--visible':''}`}>{settings[key].toFixed(2)}</output></label>
                    <input type="range" min={min} max={max} step={0.01} value={settings[key]}
                      onChange={e=>handleCtrlChange(key,parseFloat(e.target.value))}/>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Export */}
          <section className="panel-section panel-section--export">
            {isCreator&&<div className="creator-badge">Creator</div>}
            <button className={`btn-export${isRecording?' btn-export--stop':''}`}
              onClick={handleExport}
              disabled={!hasAudio}
              aria-label={isRecording?'Stop recording and export':'Record a video clip'}>
              {isRecording?'Stop & Export':'Record Visual'}
            </button>

          </section>

        </aside>
      )}

      <audio ref={audioRef}/>

      {/* Error toast — appears only on failure, dismisses on click */}
      {appError && (
        <div className="app-error" role="alert" onClick={()=>setAppError(null)}>
          <span>{appError}</span>
          <button aria-label="Dismiss">×</button>
        </div>
      )}

      {showExport&&exportResult&&(
        <ExportDialog recording={exportResult} snapshot={exportSnapshot}
          onClose={()=>{setShowExport(false);setExportResult(null)}}
          autoDownload={isCreator}
          onActivateCreator={activateCreator} onExportClean={handleExportClean}/>
      )}
    </div>
  )
}
