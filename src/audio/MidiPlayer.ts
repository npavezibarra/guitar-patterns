import { NoteEvent } from '../music/NoteEvent';

export class MidiPlayer {
  private context: AudioContext;
  private activeNodes: { osc: OscillatorNode; gain: GainNode }[] = [];

  constructor(context: AudioContext) {
    this.context = context;
  }

  playNotes(notes: NoteEvent[]) {
    this.stop(); // Clear any existing playback

    const now = this.context.currentTime;

    notes.forEach(note => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'triangle';
      osc.frequency.value = 440 * Math.pow(2, (note.pitch - 69) / 12);

      const startTime = now + note.startTime;
      const duration = Math.max(0.05, note.endTime ? (note.endTime - note.startTime) : 0.1);
      const endTime = startTime + duration;

      const attackEnd = startTime + Math.min(0.02, duration * 0.2);
      const releaseStart = Math.max(attackEnd, endTime - Math.min(0.05, duration * 0.2));

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.5, attackEnd);
      gain.gain.setValueAtTime(0.5, releaseStart);
      gain.gain.linearRampToValueAtTime(0, endTime);

      osc.connect(gain);
      gain.connect(this.context.destination);

      osc.start(startTime);
      osc.stop(endTime);

      this.activeNodes.push({ osc, gain });
    });
  }

  stop() {
    const now = this.context.currentTime;
    this.activeNodes.forEach(({ osc, gain }) => {
      try {
        osc.stop(now);
        osc.disconnect();
        gain.disconnect();
      } catch (e) {
        // Ignore if already stopped
      }
    });
    this.activeNodes = [];
  }
}
