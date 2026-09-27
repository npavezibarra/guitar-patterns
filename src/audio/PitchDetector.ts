export class PitchDetector {
  private sampleRate: number;
  private yinBuffer: Float32Array;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.yinBuffer = new Float32Array(1024);
  }

  detectPitch(buffer: Float32Array): number | null {
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / buffer.length);

    if (rms < 0.01) return null;

    const half = Math.floor(buffer.length / 2);
    const minPeriod = Math.floor(this.sampleRate / 1000);
    const maxPeriod = Math.floor(this.sampleRate / 70);
    
    const end = Math.min(half, maxPeriod);
    if (this.yinBuffer.length < end) {
      this.yinBuffer = new Float32Array(end);
    }

    for (let tau = 0; tau < end; tau++) {
      let diff = 0;
      for (let i = 0; i < half; i++) {
        const delta = buffer[i] - buffer[i + tau];
        diff += delta * delta;
      }
      this.yinBuffer[tau] = diff;
    }

    this.yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < end; tau++) {
      runningSum += this.yinBuffer[tau];
      this.yinBuffer[tau] *= tau / runningSum;
    }

    let tauEstimate = -1;
    const threshold = 0.15;
    for (let tau = minPeriod; tau < end; tau++) {
      if (this.yinBuffer[tau] < threshold) {
        while (tau + 1 < end && this.yinBuffer[tau + 1] < this.yinBuffer[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    if (tauEstimate === -1) {
      let minVal = Infinity;
      for (let tau = minPeriod; tau < end; tau++) {
        if (this.yinBuffer[tau] < minVal) {
          minVal = this.yinBuffer[tau];
          tauEstimate = tau;
        }
      }
    }

    let betterTau = tauEstimate;
    if (tauEstimate > 0 && tauEstimate < end - 1) {
      const s0 = this.yinBuffer[tauEstimate - 1];
      const s1 = this.yinBuffer[tauEstimate];
      const s2 = this.yinBuffer[tauEstimate + 1];
      const shift = 0.5 * (s0 - s2) / (s0 - 2 * s1 + s2);
      betterTau = tauEstimate + shift;
    }

    return this.sampleRate / betterTau;
  }

  static freqToMidi(freq: number): number {
    return Math.round(69 + 12 * Math.log2(freq / 440));
  }

  static midiToNoteName(midi: number): string {
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const note = NOTE_NAMES[midi % 12];
    return `${note}${octave}`;
  }
}
