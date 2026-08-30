/**
 * Web Audio Ambient Chill Soundscape & SFX Engine for The Board
 * -------------------------------------------------------------
 * Replaces harsh engine drone with a light, futuristic, and relaxing soundscape:
 * - Minimal Chill Ambient: Warm neon chords, soft atmospheric night breeze, and sleek electric hover tone.
 * - Interactive Crystal Chimes: Melodic pentatonic chimes on spot hover & holographic select SFX.
 * - Non-intrusive, aesthetic, smooth fades, and zero-pop audio context unlocking.
 */

class AmbientSoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.breezeGain = null;
    this.gliderGain = null;
    this.sfxGain = null;
    this.limiter = null;

    // Ambient Pad Chords (Warm Cyber-Jazz / Ambient Night Chords)
    this.padOscs = [];
    this.padFilter = null;
    this.padLfo = null;
    this.padLfoGain = null;

    // Soft City Breeze / Aero Wind
    this.breezeNoise = null;
    this.breezeFilter = null;

    // Sleek Electric Glider Hum
    this.gliderOsc = null;
    this.gliderSub = null;
    this.gliderFilter = null;

    this.isInitialized = false;
    this.isPlaying = false;
    this.isMuted = true; // Strictly muted by default on initial page load

    // Refined volumes (Light, pleasant, atmospheric)
    this.TARGET_MASTER = 0.28;
    this.TARGET_AMBIENT = 0.18;
    this.TARGET_BREEZE = 0.10;
    this.TARGET_GLIDER = 0.08;
    this.TARGET_SFX = 0.22;

    this.lastHoverTime = 0;
    this.pentatonicScale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5, D5, E5, G5, A5, C6
  }

  /**
   * Initializes AudioContext (stays muted unless startUnmuted is true)
   */
  async init(startUnmuted = false) {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      if (startUnmuted && this.isMuted) {
        this.isMuted = false;
        if (this.masterGain) {
          this.masterGain.gain.linearRampToValueAtTime(this.TARGET_MASTER, this.ctx.currentTime + 0.3);
        }
      }
      return true;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;

      this.ctx = new AudioCtx();
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }

      // Master Chain with Dynamics Compressor (Limiter)
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.setValueAtTime(-6, this.ctx.currentTime);
      this.limiter.knee.setValueAtTime(6, this.ctx.currentTime);
      this.limiter.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.limiter.release.setValueAtTime(0.12, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      const initialGain = startUnmuted ? this.TARGET_MASTER : 0.0001;
      this.masterGain.gain.setValueAtTime(initialGain, this.ctx.currentTime);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.TARGET_SFX, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.masterGain.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);

      // Build Subsystems
      this._buildAmbientPad();
      this._buildCityBreeze();
      this._buildElectricGlider();

      this.isInitialized = true;
      this.isPlaying = true;
      this.isMuted = !startUnmuted;

      console.log("[AudioEngine] Sound engine initialized (Muted:", this.isMuted, ")");
      return true;
    } catch (e) {
      console.warn("[AudioEngine] AudioContext init error:", e);
      return false;
    }
  }

  /**
   * Warm, soothing cyber ambient chord pad (D#m9 / Bb atmospheric resonance)
   */
  _buildAmbientPad() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(this.TARGET_AMBIENT, now);

    this.padFilter = this.ctx.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.setValueAtTime(420, now);
    this.padFilter.Q.setValueAtTime(2.0, now);

    // LFO for slow breathing filter movement
    this.padLfo = this.ctx.createOscillator();
    this.padLfo.frequency.setValueAtTime(0.14, now); // Slow 7-second breath
    this.padLfoGain = this.ctx.createGain();
    this.padLfoGain.gain.setValueAtTime(140, now);
    this.padLfo.connect(this.padLfoGain);
    this.padLfoGain.connect(this.padFilter.frequency);
    this.padLfo.start(now);

    // Chord frequencies (D#3, A#3, F4, G#4, C#5 for a lush, floating cyber chord)
    const chordFreqs = [155.56, 233.08, 349.23, 415.3, 554.37];

    this.padOscs = chordFreqs.map((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 0.8, now); // subtle detune

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.24 / chordFreqs.length, now);

      osc.connect(oscGain);
      oscGain.connect(this.padFilter);
      osc.start(now);
      return osc;
    });

    this.padFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);
  }

  /**
   * Soft City Breeze & Aero Wind (Replaces harsh road noise)
   */
  _buildCityBreeze() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.breezeGain = this.ctx.createGain();
    this.breezeGain.gain.setValueAtTime(this.TARGET_BREEZE, now);

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02; // Pink noise
      lastOut = output[i];
    }

    this.breezeNoise = this.ctx.createBufferSource();
    this.breezeNoise.buffer = noiseBuffer;
    this.breezeNoise.loop = true;

    this.breezeFilter = this.ctx.createBiquadFilter();
    this.breezeFilter.type = "bandpass";
    this.breezeFilter.frequency.setValueAtTime(360, now);
    this.breezeFilter.Q.setValueAtTime(1.2, now);

    this.breezeNoise.connect(this.breezeFilter);
    this.breezeFilter.connect(this.breezeGain);
    this.breezeGain.connect(this.masterGain);

    this.breezeNoise.start(now);
  }

  /**
   * Sleek Futuristic Electric Glider Hum (Ultra-light, smooth purr)
   */
  _buildElectricGlider() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.gliderGain = this.ctx.createGain();
    this.gliderGain.gain.setValueAtTime(this.TARGET_GLIDER, now);

    this.gliderFilter = this.ctx.createBiquadFilter();
    this.gliderFilter.type = "lowpass";
    this.gliderFilter.frequency.setValueAtTime(320, now);

    this.gliderOsc = this.ctx.createOscillator();
    this.gliderOsc.type = "sine";
    this.gliderOsc.frequency.setValueAtTime(124, now);

    this.gliderSub = this.ctx.createOscillator();
    this.gliderSub.type = "triangle";
    this.gliderSub.frequency.setValueAtTime(62, now);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.4, now);
    this.gliderSub.connect(subGain);

    this.gliderOsc.connect(this.gliderFilter);
    subGain.connect(this.gliderFilter);
    this.gliderFilter.connect(this.gliderGain);
    this.gliderGain.connect(this.masterGain);

    this.gliderOsc.start(now);
    this.gliderSub.start(now);
  }

  /**
   * Play a pleasant crystal pentatonic chime when hovering over a billboard
   */
  playHover(spotId = 0) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    // Throttle chimes to at least 70ms apart so fast scrubbing sounds musical, not chaotic
    if (now - this.lastHoverTime < 0.07) return;
    this.lastHoverTime = now;

    try {
      const noteIdx = Math.abs(Number(spotId) || 0) % this.pentatonicScale.length;
      const freq = this.pentatonicScale[noteIdx];

      // Primary crystal sine
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      // Shimmer overtone (soft harmonic sparkle)
      const shimmer = this.ctx.createOscillator();
      shimmer.type = "triangle";
      shimmer.frequency.setValueAtTime(freq * 2.0, now);

      const chimeGain = this.ctx.createGain();
      chimeGain.gain.setValueAtTime(0.0001, now);
      chimeGain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      const shimmerGain = this.ctx.createGain();
      shimmerGain.gain.setValueAtTime(0.0001, now);
      shimmerGain.gain.exponentialRampToValueAtTime(0.06, now + 0.012);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc.connect(chimeGain);
      shimmer.connect(shimmerGain);

      chimeGain.connect(this.sfxGain);
      shimmerGain.connect(this.sfxGain);

      osc.start(now);
      shimmer.start(now);
      osc.stop(now + 0.3);
      shimmer.stop(now + 0.3);
    } catch (e) {
      // Ignore audio error
    }
  }

  /**
   * Play a rewarding holographic crystal chime when selecting a spot
   */
  playSelect() {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;

      // Two-tone rising harmonic chime (E5 -> B5)
      const tones = [
        { freq: 659.25, time: 0, dur: 0.28, vol: 0.22 },
        { freq: 987.77, time: 0.06, dur: 0.36, vol: 0.26 },
      ];

      tones.forEach((t) => {
        const osc = this.ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(t.freq, now + t.time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now + t.time);
        gain.gain.exponentialRampToValueAtTime(t.vol, now + t.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t.time + t.dur);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now + t.time);
        osc.stop(now + t.time + t.dur + 0.05);
      });
    } catch (e) {
      // Ignore audio error
    }
  }

  /**
   * Play a clean sci-fi tactile click for UI actions (e.g. camera switch, claim click)
   */
  playAction() {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(780, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.06);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      // Ignore audio error
    }
  }

  /**
   * Updates audio parameters smoothly on frame loop (subtle speed & atmosphere response)
   */
  update(delta = 0.016, speed = 32.0, isAccelerating = false) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;

    // 1. Subtle breeze wind modulation
    if (this.breezeFilter && this.breezeGain) {
      const targetBreezeFreq = 340 + (speed / 35.0) * 120 + (isAccelerating ? 80 : 0);
      this.breezeFilter.frequency.setTargetAtTime(targetBreezeFreq, now, 0.1);
      this.breezeGain.gain.setTargetAtTime(this.TARGET_BREEZE * (isAccelerating ? 1.25 : 1.0), now, 0.1);
    }

    // 2. Futuristic glider pitch modulation (smooth electric hum)
    if (this.gliderOsc && this.gliderGain) {
      const targetGliderFreq = 120 + (speed / 35.0) * 28 + (isAccelerating ? 24 : 0);
      this.gliderOsc.frequency.setTargetAtTime(targetGliderFreq, now, 0.12);
    }
  }

  /**
   * Toggle Mute / Unmute
   */
  toggleMute() {
    if (!this.isInitialized) {
      this.init(true);
      return true;
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      const target = this.isMuted ? 0.0001 : this.TARGET_MASTER;
      this.masterGain.gain.linearRampToValueAtTime(target, now + 0.2);
    }
    return !this.isMuted;
  }

  /**
   * Set Mute explicitly
   */
  setMuted(mute) {
    if (!this.isInitialized && !mute) {
      this.init();
      return;
    }
    this.isMuted = mute;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      const target = this.isMuted ? 0.0001 : this.TARGET_MASTER;
      this.masterGain.gain.linearRampToValueAtTime(target, now + 0.2);
    }
  }
}

export const audioManager = new AmbientSoundEngine();
