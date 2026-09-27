import { audioEngine } from './AudioEngine';
import { MusicalClock } from '../music/MusicalClock';

export class Metronome {
  clock: MusicalClock;
  isPlaying: boolean = false;
  sessionStartTime: number = 0;
  
  private nextNoteTime: number = 0;
  private currentBeatInMeasure: number = 0;
  private timerID: number | null = null;
  private lookahead: number = 25.0; // ms
  private scheduleAheadTime: number = 0.1; // s

  constructor(clock: MusicalClock) {
    this.clock = clock;
  }

  start() {
    audioEngine.init();
    this.isPlaying = true;
    this.sessionStartTime = audioEngine.getCurrentTime();
    this.nextNoteTime = this.sessionStartTime;
    this.currentBeatInMeasure = 0; // 0-indexed internally
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.timerID !== null) {
      window.clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  private nextNote() {
    const secondsPerBeat = this.clock.getBeatDuration();
    this.nextNoteTime += secondsPerBeat;
    this.currentBeatInMeasure++;
    if (this.currentBeatInMeasure >= this.clock.timeSignature.numerator) {
      this.currentBeatInMeasure = 0;
    }
  }

  private scheduleNote(beatNumber: number, time: number) {
    if (!audioEngine.context) return;
    
    const osc = audioEngine.context.createOscillator();
    const envelope = audioEngine.context.createGain();

    // Beat 0 (first beat) has higher pitch
    osc.frequency.value = (beatNumber === 0) ? 1000 : 800;

    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(1, time + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(envelope);
    envelope.connect(audioEngine.context.destination);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  private scheduler() {
    if (!this.isPlaying || !audioEngine.context) return;

    while (this.nextNoteTime < audioEngine.getCurrentTime() + this.scheduleAheadTime) {
      this.scheduleNote(this.currentBeatInMeasure, this.nextNoteTime);
      this.nextNote();
    }

    this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
  }
}
