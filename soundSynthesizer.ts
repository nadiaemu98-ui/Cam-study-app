/**
 * Web Audio API Sound Generator & Synthesizer
 * No external sound files needed.
 */

class SoundSynthesizer {
  private audioCtx: AudioContext | null = null;
  public volume = 0.8;
  public isMuted = false;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public playBeep(freq = 600, duration = 300, type: OscillatorType = 'sine') {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(this.volume * 0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration / 1000);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  public playWarningSound() {
    // High-pitched urgent double beep
    this.playBeep(900, 250, 'sawtooth');
    setTimeout(() => {
      this.playBeep(1100, 300, 'sawtooth');
    }, 150);
  }

  public playSoftChime() {
    if (this.isMuted) return;
    // Gentle melodic chime for soft face-absence warning
    this.playBeep(659.25, 200, 'sine'); // E5
    setTimeout(() => this.playBeep(880.00, 300, 'sine'), 150); // A5
  }

  public playHourlySound() {
    // Pleasant melody chime
    this.playBeep(523.25, 200, 'sine'); // C5
    setTimeout(() => this.playBeep(659.25, 200, 'sine'), 150); // E5
    setTimeout(() => this.playBeep(783.99, 350, 'sine'), 300); // G5
  }

  public playSessionEndSound() {
    // Low triple warning tone
    this.playBeep(400, 300, 'square');
    setTimeout(() => this.playBeep(350, 300, 'square'), 300);
    setTimeout(() => this.playBeep(300, 600, 'square'), 600);
  }

  public playSuccessSound() {
    // Uplifting chime
    this.playBeep(440, 150, 'sine');
    setTimeout(() => this.playBeep(554.37, 150, 'sine'), 120);
    setTimeout(() => this.playBeep(659.25, 300, 'sine'), 240);
  }

  // Ghibli Ambient Nature Sound Generator
  private ambientNoiseNode: AudioNode | null = null;
  private ambientGainNode: GainNode | null = null;
  private ambientType: string | null = null;

  public stopAmbient() {
    if (this.ambientGainNode && this.audioCtx) {
      try {
        this.ambientGainNode.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.5);
        setTimeout(() => {
          if (this.ambientNoiseNode) {
            (this.ambientNoiseNode as AudioBufferSourceNode).stop?.();
            this.ambientNoiseNode.disconnect();
            this.ambientNoiseNode = null;
          }
          this.ambientGainNode = null;
          this.ambientType = null;
        }, 500);
      } catch (e) {
        console.warn('Error stopping ambient sound:', e);
      }
    }
  }

  public toggleAmbient(type: 'rain' | 'forest' | 'windchime'): string | null {
    if (this.ambientType === type) {
      this.stopAmbient();
      return null;
    }

    this.stopAmbient();
    const ctx = this.getAudioContext();
    this.ambientType = type;

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'rain') {
      // Soft pink noise for rain
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1000;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noiseSource.start();
      this.ambientNoiseNode = noiseSource;
      this.ambientGainNode = gain;
    } else if (type === 'forest' || type === 'windchime') {
      // Soft gentle pentatonic wind chime loop
      const chimeInterval = setInterval(() => {
        if (this.ambientType !== type) {
          clearInterval(chimeInterval);
          return;
        }
        const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        const pitch = notes[Math.floor(Math.random() * notes.length)];
        this.playBeep(pitch, 800, 'sine');
      }, 2500);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      this.ambientGainNode = gain;
    }

    return type;
  }
}

export const soundSynth = new SoundSynthesizer();
