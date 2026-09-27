import { create } from 'zustand';
import { TimeSignature, TIME_SIGNATURES } from '../music/TimeSignature';
import { NoteEvent } from '../music/NoteEvent';

export interface SessionState {
  id: string;
  createdAt: number;
  bpm: number;
  timeSignature: TimeSignature;
  isRecording: boolean;
  isPlaying: boolean;
  noteEvents: NoteEvent[];
  sessionStartTime: number | null;
  playbackStartTime: number | null;
  
  // Actions
  setBpm: (bpm: number) => void;
  setTimeSignature: (ts: TimeSignature) => void;
  startRecording: () => void;
  stopRecording: () => void;
  startPlayback: () => void;
  stopPlayback: () => void;
  addNoteEvent: (note: NoteEvent) => void;
  updateNoteEvent: (id: string, updates: Partial<NoteEvent>) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  bpm: 120,
  timeSignature: TIME_SIGNATURES['4/4'],
  isRecording: false,
  isPlaying: false,
  noteEvents: [],
  sessionStartTime: null,
  playbackStartTime: null,

  setBpm: (bpm) => set({ bpm }),
  setTimeSignature: (timeSignature) => set({ timeSignature }),
  
  startRecording: () => {
    set({
      isRecording: true,
      isPlaying: false,
      noteEvents: [],
      id: crypto.randomUUID(),
      createdAt: Date.now()
    });
  },

  stopRecording: () => {
    set({ isRecording: false });
  },

  startPlayback: () => {
    set({ isPlaying: true, isRecording: false, playbackStartTime: Date.now() }); // Date.now() is just a marker, AudioEngine manages real time
  },

  stopPlayback: () => {
    set({ isPlaying: false, playbackStartTime: null });
  },

  addNoteEvent: (note) => set((state) => ({ noteEvents: [...state.noteEvents, note] })),
  
  updateNoteEvent: (id, updates) => set((state) => ({
    noteEvents: state.noteEvents.map(n => n.id === id ? { ...n, ...updates } : n)
  })),

  clearSession: () => set({ noteEvents: [], sessionStartTime: null, isRecording: false, isPlaying: false })
}));
