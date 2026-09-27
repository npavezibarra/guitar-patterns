import { GuitarTracker, NoteEventCallbacks } from './GuitarTracker';
import { PitchDetector } from './PitchDetector';
import { MidiPlayer } from './MidiPlayer';

export class AudioEngine {
  context: AudioContext | null = null;
  inputDevices: MediaDeviceInfo[] = [];
  selectedInputId: string | null = null;
  mediaStream: MediaStream | null = null;
  mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  analyserNode: AnalyserNode | null = null;
  inputStatus: 'No audio input' | 'Connected' | 'Input permission denied' | 'Input disconnected' = 'No audio input';

  private tracker: GuitarTracker | null = null;
  private trackerCallbacks: NoteEventCallbacks | null = null;
  
  private uiDetector: PitchDetector | null = null;
  private uiBuffer: Float32Array | null = null;
  
  midiPlayer: MidiPlayer | null = null;

  init() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.midiPlayer = new MidiPlayer(this.context);
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  getCurrentTime(): number {
    return this.context ? this.context.currentTime : 0;
  }

  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.inputDevices = devices.filter(d => d.kind === 'audioinput');
      return this.inputDevices;
    } catch (e) {
      console.error('Error enumerating devices', e);
      return [];
    }
  }

  async connectDevice(deviceId: string): Promise<void> {
    this.init();
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
    }

    try {
      const constraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      };
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.selectedInputId = deviceId;
      this.inputStatus = 'Connected';

      await this.enumerateDevices();

      if (this.context) {
        this.mediaStreamSource = this.context.createMediaStreamSource(this.mediaStream);
        this.analyserNode = this.context.createAnalyser();
        this.analyserNode.fftSize = 2048;
        this.mediaStreamSource.connect(this.analyserNode);

        this.uiDetector = new PitchDetector(this.context.sampleRate);
        this.uiBuffer = new Float32Array(this.analyserNode.fftSize);

        if (this.tracker) {
          // If we already have a tracker running (re-connecting device), just stop it and create a new one
          this.tracker.stop();
        }
        
        if (this.trackerCallbacks) {
          this.tracker = new GuitarTracker(this.analyserNode, this.context.sampleRate, this.trackerCallbacks);
        }
      }
    } catch (e: any) {
      console.error('Error connecting device', e);
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        this.inputStatus = 'Input permission denied';
      } else {
        this.inputStatus = 'Input disconnected';
      }
      this.mediaStream = null;
      this.selectedInputId = null;
    }
  }

  getAudioLevel(): number {
    if (!this.analyserNode) return 0;
    
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(dataArray);
    
    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] / 128.0) - 1.0;
      sumSquares += normalized * normalized;
    }
    return Math.sqrt(sumSquares / dataArray.length);
  }

  getDetectedPitchMidi(): number | null {
    if (!this.analyserNode || !this.uiDetector || !this.uiBuffer) return null;
    this.analyserNode.getFloatTimeDomainData(this.uiBuffer as any);
    const freq = this.uiDetector.detectPitch(this.uiBuffer);
    if (freq === null) return null;
    return PitchDetector.freqToMidi(freq);
  }

  setTrackerCallbacks(callbacks: NoteEventCallbacks) {
    this.trackerCallbacks = callbacks;
    if (this.tracker) {
      this.tracker.setCallbacks(callbacks);
    } else if (this.analyserNode && this.context) {
      this.tracker = new GuitarTracker(this.analyserNode, this.context.sampleRate, callbacks);
    }
  }

  startTracking() {
    if (this.tracker) this.tracker.start();
  }

  stopTracking() {
    if (this.tracker) this.tracker.stop();
  }
}

export const audioEngine = new AudioEngine();
