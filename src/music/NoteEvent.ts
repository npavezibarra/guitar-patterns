export interface NoteEvent {
  id: string;
  pitch: number;        // MIDI note number
  frequency?: number;
  startTime: number;    // seconds from session start
  endTime?: number;
  velocity?: number;
}
