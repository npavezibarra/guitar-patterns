import React, { useEffect, useState, useRef } from 'react';
import { useSessionStore } from '../session/SessionStore';
import { MusicalClock } from '../music/MusicalClock';
import { audioEngine } from '../audio/AudioEngine';

interface MeasureViewProps {
  viewedMeasure?: number;
}

export const MeasureView: React.FC<MeasureViewProps> = ({ viewedMeasure = 1 }) => {
  const { bpm, timeSignature, isRecording, isPlaying, noteEvents } = useSessionStore();
  const [currentTime, setCurrentTime] = useState(0);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    if (isRecording || isPlaying) {
      setSessionStart(audioEngine.getCurrentTime());
      const animate = () => {
        setCurrentTime(audioEngine.getCurrentTime());
        requestRef.current = requestAnimationFrame(animate);
      };
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      setSessionStart(null);
      setCurrentTime(0);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isRecording, isPlaying]);

  const clock = new MusicalClock(bpm, timeSignature);
  const measureDuration = clock.getMeasureDuration();
  
  const elapsedTime = sessionStart !== null ? currentTime - sessionStart : 0;
  const position = clock.getPosition(elapsedTime);
  
  const playheadPercent = (isRecording || isPlaying) ? position.normalizedPositionWithinMeasure * 100 : 0;
  const currentMeasure = (isRecording || isPlaying) ? position.measureNumber : viewedMeasure;

  const measureStartTime = (currentMeasure - 1) * measureDuration;
  const measureEndTime = currentMeasure * measureDuration;

  const getNoteLeftPercent = (time: number) => {
    const relativeTime = time - measureStartTime;
    return (relativeTime / measureDuration) * 100;
  };

  const renderNotes = () => {
    return noteEvents.map(note => {
      const end = note.endTime || elapsedTime;
      if (end < measureStartTime || note.startTime > measureEndTime) return null;
      
      const left = getNoteLeftPercent(note.startTime);
      const right = getNoteLeftPercent(end);
      
      const visibleLeft = Math.max(0, left);
      const visibleRight = Math.min(100, right);
      const width = visibleRight - visibleLeft;

      const minPitch = 40;
      const maxPitch = 80;
      const yPercent = 100 - ((note.pitch - minPitch) / (maxPitch - minPitch)) * 100;

      return (
        <div
          key={note.id}
          style={{
            position: 'absolute',
            left: `${visibleLeft}%`,
            top: `${yPercent}%`,
            width: `${width}%`,
            height: '20px',
            backgroundColor: '#f97316',
            borderRadius: '4px',
            transform: 'translateY(-50%)',
            opacity: 0.8
          }}
        />
      );
    });
  };

  const renderBeatDivisions = () => {
    const beats = [];
    for (let i = 0; i < timeSignature.numerator; i++) {
      const xPercent = (i / timeSignature.numerator) * 100;
      beats.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${xPercent}%`,
            top: 0,
            bottom: 0,
            width: '1px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)'
          }}
        />
      );
    }
    return beats;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ color: '#aaa', marginBottom: '10px', fontSize: '14px' }}>
        Measure {currentMeasure}
      </div>
      <div style={{ position: 'relative', flex: 1, backgroundColor: '#2a2a2a', borderRadius: '4px', overflow: 'hidden' }}>
        {renderBeatDivisions()}
        {renderNotes()}
        {(isRecording || isPlaying) && currentMeasure === position.measureNumber && (
          <div
            style={{
              position: 'absolute',
              left: `${playheadPercent}%`,
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: isPlaying ? '#3b82f6' : '#ef4444',
              zIndex: 10
            }}
          />
        )}
      </div>
    </div>
  );
};
