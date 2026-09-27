import { PitchDetector } from './PitchDetector';

export type NoteEventCallbacks = {
  onNoteStart: (pitch: number, time: number) => void;
  onNoteEnd: (time: number) => void;
};

export class GuitarTracker {
  private analyser: AnalyserNode;
  private detector: PitchDetector;
  private buffer: Float32Array;
  private callbacks: NoteEventCallbacks;
  
  private tracking: boolean = false;
  private reqId: number = 0;

  private lastOnsetTime: number = 0;
  private waitingForPitchAfterOnset: boolean = false;
  
  private activeNotePitch: number | null = null;
  private candidatePitch: number | null = null;
  private candidateStartTime: number = 0;
  private lastActiveTime: number = 0;
  
  private lastHfRms: number = 0;
  private pitchHistory: number[] = [];

  // Calibración de latencia (en segundos). 
  // Compensa el retraso del hardware + el tiempo que tardamos en detectar el onset.
  private latencyCompensation = 0.04; 

  constructor(analyser: AnalyserNode, sampleRate: number, callbacks: NoteEventCallbacks) {
    this.analyser = analyser;
    this.callbacks = callbacks;
    this.detector = new PitchDetector(sampleRate);
    this.buffer = new Float32Array(analyser.fftSize); 
  }

  setCallbacks(callbacks: NoteEventCallbacks) {
    this.callbacks = callbacks;
  }

  start() {
    if (this.tracking) return;
    this.tracking = true;
    this.activeNotePitch = null;
    this.candidatePitch = null;
    this.lastHfRms = 0;
    this.pitchHistory = [];
    this.waitingForPitchAfterOnset = false;
    this.loop();
  }

  stop() {
    this.tracking = false;
    if (this.reqId) cancelAnimationFrame(this.reqId);
    if (this.activeNotePitch !== null) {
      this.callbacks.onNoteEnd(this.analyser.context.currentTime);
      this.activeNotePitch = null;
    }
  }

  private getMedianPitch(): number | null {
    if (this.pitchHistory.length === 0) return null;
    const sorted = [...this.pitchHistory].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  private loop = () => {
    if (!this.tracking) return;
    this.reqId = requestAnimationFrame(this.loop);
    
    this.analyser.getFloatTimeDomainData(this.buffer as any);
    
    const shortSize = 256;
    const startIdx = this.buffer.length - shortSize;
    
    let rmsShort = 0;
    let hfEnergy = 0;
    
    for (let i = startIdx; i < this.buffer.length; i++) {
      rmsShort += this.buffer[i] * this.buffer[i];
      const diff = this.buffer[i] - this.buffer[i - 1]; 
      hfEnergy += diff * diff;
    }
    rmsShort = Math.sqrt(rmsShort / shortSize);
    const hfRms = Math.sqrt(hfEnergy / shortSize);

    const now = this.analyser.context.currentTime;
    const freq = this.detector.detectPitch(this.buffer);

    const isOnset = rmsShort > 0.01 && hfRms > this.lastHfRms * 1.5 && (now - this.lastOnsetTime > 0.07); 
    
    if (isOnset) {
      this.lastOnsetTime = now;
      this.pitchHistory = []; 
      this.waitingForPitchAfterOnset = true; // Record the onset, wait for pitch to stabilize
    }

    if (freq !== null && rmsShort > 0.005) {
      const rawMidi = PitchDetector.freqToMidi(freq);
      this.pitchHistory.push(rawMidi);
      if (this.pitchHistory.length > 5) this.pitchHistory.shift(); 

      const stableMidi = this.getMedianPitch();

      // We only commit to a note if we have 2 consistent pitch frames
      if (stableMidi !== null && this.pitchHistory.length >= 2) {
        
        const compensatedTime = this.lastOnsetTime - this.latencyCompensation;

        if (this.waitingForPitchAfterOnset) {
          // The pitch stabilized after a hard pick attack
          this.waitingForPitchAfterOnset = false;
          
          if (this.activeNotePitch !== null) {
            this.callbacks.onNoteEnd(compensatedTime);
          }
          this.activeNotePitch = stableMidi;
          this.callbacks.onNoteStart(stableMidi, Math.max(0, compensatedTime));
          this.lastActiveTime = now;
          this.candidatePitch = null;
        } 
        else if (stableMidi !== this.activeNotePitch) {
          // Pitch changed without a hard pick (hammer-on / slide)
          if (stableMidi === this.candidatePitch) {
            if (now - this.candidateStartTime > 0.04) {
              const transitionTime = this.candidateStartTime - this.latencyCompensation;
              this.callbacks.onNoteEnd(transitionTime);
              this.activeNotePitch = stableMidi;
              this.callbacks.onNoteStart(stableMidi, Math.max(0, transitionTime));
              this.lastActiveTime = now;
              this.candidatePitch = null;
            }
          } else {
            this.candidatePitch = stableMidi;
            this.candidateStartTime = now;
          }
        } 
        else {
          this.lastActiveTime = now;
          this.candidatePitch = null;
        }
      }
    } else {
      this.pitchHistory = [];
      if (this.activeNotePitch !== null && now - this.lastActiveTime > 0.06) {
        this.callbacks.onNoteEnd(now);
        this.activeNotePitch = null;
      }
      this.waitingForPitchAfterOnset = false;
    }
    
    this.lastHfRms = this.lastHfRms * 0.3 + hfRms * 0.7;
  }
}
