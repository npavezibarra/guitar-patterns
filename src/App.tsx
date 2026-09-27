import { useEffect, useRef, useState, useMemo } from 'react';
import { useSessionStore } from './session/SessionStore';
import { TIME_SIGNATURES } from './music/TimeSignature';
import { MeasureView } from './components/MeasureView';
import { Metronome } from './audio/Metronome';
import { MusicalClock } from './music/MusicalClock';
import { audioEngine } from './audio/AudioEngine';
import { AudioInputSelector } from './components/AudioInputSelector';

function App() {
  const { 
    bpm, setBpm, 
    timeSignature, setTimeSignature, 
    isRecording, startRecording, stopRecording,
    isPlaying, startPlayback, stopPlayback,
    addNoteEvent, updateNoteEvent, noteEvents
  } = useSessionStore();

  const metronomeRef = useRef<Metronome | null>(null);
  const currentNoteIdRef = useRef<string | null>(null);
  const pitchCycleRef = useRef<number>(60);
  const sessionStartTimeRef = useRef<number>(0);
  const autoNoteIdRef = useRef<string | null>(null);

  const [viewedMeasure, setViewedMeasure] = useState<number>(1);

  const totalMeasures = useMemo(() => {
    if (noteEvents.length === 0) return 1;
    const maxTime = Math.max(...noteEvents.map(n => Math.max(n.startTime, n.endTime || n.startTime)));
    const clock = new MusicalClock(bpm, timeSignature);
    return clock.getPosition(maxTime).measureNumber;
  }, [noteEvents, bpm, timeSignature]);

  useEffect(() => {
    if (viewedMeasure > totalMeasures && totalMeasures > 0) {
      setViewedMeasure(totalMeasures);
    }
  }, [totalMeasures, viewedMeasure]);

  // Setup Guitar Pitch Tracking callbacks ONCE
  useEffect(() => {
    audioEngine.setTrackerCallbacks({
      onNoteStart: (pitch, absoluteTime) => {
        if (!useSessionStore.getState().isRecording) return;
        const id = crypto.randomUUID();
        const startTime = absoluteTime - sessionStartTimeRef.current;
        useSessionStore.getState().addNoteEvent({ id, pitch, startTime });
        autoNoteIdRef.current = id;
      },
      onNoteEnd: (absoluteTime) => {
        if (autoNoteIdRef.current) {
          const endTime = absoluteTime - sessionStartTimeRef.current;
          useSessionStore.getState().updateNoteEvent(autoNoteIdRef.current, { endTime });
          autoNoteIdRef.current = null;
        }
      }
    });
  }, []); // <-- Empty dependency array! Only sets it once.

  // Setup Keyboard bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && useSessionStore.getState().isRecording && !e.repeat && !currentNoteIdRef.current) {
        e.preventDefault();
        const id = crypto.randomUUID();
        const pitch = pitchCycleRef.current;
        
        pitchCycleRef.current += 2;
        if (pitchCycleRef.current > 70) pitchCycleRef.current = 50;

        const startTime = audioEngine.getCurrentTime() - sessionStartTimeRef.current;
        
        useSessionStore.getState().addNoteEvent({ id, pitch, startTime });
        currentNoteIdRef.current = id;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && useSessionStore.getState().isRecording && currentNoteIdRef.current) {
        e.preventDefault();
        const endTime = audioEngine.getCurrentTime() - sessionStartTimeRef.current;
        useSessionStore.getState().updateNoteEvent(currentNoteIdRef.current, { endTime });
        currentNoteIdRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); // <-- Empty dependency array

  const toggleRecording = () => {
    if (isPlaying) {
      stopPlayback();
      if (audioEngine.midiPlayer) audioEngine.midiPlayer.stop();
    }

    if (isRecording) {
      stopRecording();
      audioEngine.stopTracking();
      if (metronomeRef.current) {
        metronomeRef.current.stop();
      }
      if (currentNoteIdRef.current) {
        const endTime = audioEngine.getCurrentTime() - sessionStartTimeRef.current;
        updateNoteEvent(currentNoteIdRef.current, { endTime });
        currentNoteIdRef.current = null;
      }
      if (autoNoteIdRef.current) {
        const endTime = audioEngine.getCurrentTime() - sessionStartTimeRef.current;
        updateNoteEvent(autoNoteIdRef.current, { endTime });
        autoNoteIdRef.current = null;
      }
    } else {
      audioEngine.init();
      const clock = new MusicalClock(bpm, timeSignature);
      metronomeRef.current = new Metronome(clock);
      
      startRecording();
      metronomeRef.current.start();
      sessionStartTimeRef.current = audioEngine.getCurrentTime();
      audioEngine.startTracking();
      setViewedMeasure(1);
    }
  };

  const togglePlayback = () => {
    if (isRecording) {
      toggleRecording(); // Stop recording first
    }

    if (isPlaying) {
      stopPlayback();
      if (audioEngine.midiPlayer) audioEngine.midiPlayer.stop();
      if (metronomeRef.current) metronomeRef.current.stop();
    } else {
      audioEngine.init();
      const clock = new MusicalClock(bpm, timeSignature);
      metronomeRef.current = new Metronome(clock);
      
      startPlayback();
      metronomeRef.current.start();
      
      if (audioEngine.midiPlayer) {
        audioEngine.midiPlayer.playNotes(noteEvents);
      }
      setViewedMeasure(1);
    }
  };

  const renderMeasureNavigator = () => {
    if (isRecording || isPlaying || totalMeasures === 0) return null;

    const boxes = [];
    for (let i = 1; i <= totalMeasures; i++) {
      const isSelected = i === viewedMeasure;
      boxes.push(
        <div
          key={i}
          onClick={() => setViewedMeasure(i)}
          style={{
            padding: '4px 12px',
            backgroundColor: isSelected ? '#f97316' : '#2a2a2a',
            color: isSelected ? '#fff' : '#aaa',
            borderRadius: '4px',
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: '14px',
            border: isSelected ? '1px solid #f97316' : '1px solid #444',
          }}
        >
          {i}
        </div>
      );
    }
    
    return (
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px' }}>
        {boxes}
      </div>
    );
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#121212', color: '#fff', fontFamily: 'sans-serif', padding: '20px', boxSizing: 'border-box' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '10px', backgroundColor: '#1e1e1e', borderRadius: '8px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: '#aaa' }}>TEMPO</label>
            <input 
              type="number" 
              value={bpm} 
              onChange={e => setBpm(Number(e.target.value))}
              disabled={isRecording || isPlaying}
              style={{ width: '60px', padding: '4px', backgroundColor: '#2a2a2a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '16px' }}
            />
            <span style={{ fontSize: '14px', color: '#aaa' }}>BPM</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select 
              disabled={isRecording || isPlaying}
              value={`${timeSignature.numerator}/${timeSignature.denominator}`}
              onChange={e => setTimeSignature(TIME_SIGNATURES[e.target.value])}
              style={{ padding: '4px 8px', backgroundColor: '#2a2a2a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '16px' }}
            >
              {Object.keys(TIME_SIGNATURES).map(key => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={togglePlayback}
            disabled={isRecording || noteEvents.length === 0}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: isPlaying ? '#3b82f6' : (noteEvents.length === 0 || isRecording ? '#2a2a2a' : '#10b981'), 
              color: (noteEvents.length === 0 || isRecording) ? '#666' : '#fff', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: (noteEvents.length === 0 || isRecording) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isPlaying ? 'STOP PLAYBACK' : 'PLAY'}
          </button>
          
          <button 
            onClick={toggleRecording}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: isRecording ? '#ef4444' : '#f97316', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#fff' }} />
            {isRecording ? 'STOP REC' : 'RECORD'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', fontSize: '14px' }}>
          <AudioInputSelector />
          <div>
            {isRecording ? 'Recording...' : 
             isPlaying ? 'Playing back MIDI...' : 
             'Select a measure to review'}
          </div>
        </div>
        
        {renderMeasureNavigator()}
        <MeasureView viewedMeasure={viewedMeasure} />
      </div>

    </div>
  );
}

export default App;
