import { TimeSignature } from './TimeSignature';

export class MusicalClock {
  bpm: number;
  timeSignature: TimeSignature;
  
  constructor(bpm: number, timeSignature: TimeSignature) {
    this.bpm = bpm;
    this.timeSignature = timeSignature;
  }

  // Returns duration of a single beat in seconds
  getBeatDuration(): number {
    return 60 / this.bpm;
  }

  // Returns duration of a full measure in seconds
  getMeasureDuration(): number {
    return this.getBeatDuration() * this.timeSignature.numerator;
  }

  // Calculates the musical position from a time in seconds (relative to session start)
  getPosition(timeInSeconds: number) {
    const beatDuration = this.getBeatDuration();
    const measureDuration = this.getMeasureDuration();

    const measureNumber = Math.floor(timeInSeconds / measureDuration) + 1;
    
    const timeWithinMeasure = timeInSeconds % measureDuration;
    const beatWithinMeasure = Math.floor(timeWithinMeasure / beatDuration) + 1;
    const positionWithinBeat = (timeWithinMeasure % beatDuration) / beatDuration;
    const normalizedPositionWithinMeasure = timeWithinMeasure / measureDuration;

    return {
      measureNumber,
      beatWithinMeasure,
      positionWithinBeat,
      normalizedPositionWithinMeasure,
      timeWithinMeasure
    };
  }
}
