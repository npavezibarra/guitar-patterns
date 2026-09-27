import React, { useEffect, useState, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { PitchDetector } from '../audio/PitchDetector';

export const AudioInputSelector: React.FC = () => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [status, setStatus] = useState<string>('No audio input');
  const [level, setLevel] = useState<number>(0);
  const [detectedNote, setDetectedNote] = useState<string>('-');
  const requestRef = useRef<number>(0);

  const loadDevices = async () => {
    const devs = await audioEngine.enumerateDevices();
    setDevices(devs);
    setStatus(audioEngine.inputStatus);
    setSelectedId(audioEngine.selectedInputId || '');
  };

  useEffect(() => {
    loadDevices();
    const handleDeviceChange = () => loadDevices();
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  const handleSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    if (deviceId) {
      await audioEngine.connectDevice(deviceId);
      loadDevices();
    }
  };

  useEffect(() => {
    const updateLevel = () => {
      setLevel(audioEngine.getAudioLevel());
      
      const midi = audioEngine.getDetectedPitchMidi();
      if (midi !== null) {
        setDetectedNote(PitchDetector.midiToNoteName(midi));
      } else {
        setDetectedNote('-');
      }

      requestRef.current = requestAnimationFrame(updateLevel);
    };
    requestRef.current = requestAnimationFrame(updateLevel);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const getLevelBar = (val: number) => {
    const scaled = Math.min(1.0, val * 3); 
    const numBars = Math.floor(scaled * 20);
    return "█".repeat(numBars) + "░".repeat(Math.max(0, 20 - numBars));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ color: '#aaa' }}>Audio Input:</label>
        <select 
          value={selectedId} 
          onChange={handleSelect}
          style={{ padding: '4px', backgroundColor: '#2a2a2a', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
        >
          <option value="">Select a device...</option>
          {devices.map(d => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Unknown device (${d.deviceId.slice(0, 5)}...)`}
            </option>
          ))}
        </select>
        
        <span style={{ color: status.includes('Connected') ? '#22c55e' : '#aaa' }}>
          {status}
        </span>

        {selectedId && (
          <span style={{ fontFamily: 'monospace', color: '#22c55e', minWidth: '150px' }}>
            [{getLevelBar(level)}] 
            <span style={{ marginLeft: '10px', color: '#f97316', fontWeight: 'bold' }}>
              {detectedNote.padEnd(3, ' ')}
            </span>
          </span>
        )}
      </div>

      <div style={{ fontSize: '12px', color: '#666' }}>
        Debug: {selectedId 
          ? `ID: ${selectedId.slice(0, 8)}... | SR: ${audioEngine.context?.sampleRate || 0}Hz | RMS: ${level.toFixed(4)}` 
          : 'No device selected'}
      </div>
    </div>
  );
};
