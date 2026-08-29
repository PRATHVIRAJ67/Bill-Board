/**
 * Web Audio Supercar Sound Engine for The Board
 * ---------------------------------------------
 * Procedural synthesis engine for realistic, subtle supercar driving audio:
 * - V8 / Twin-Turbo Engine Cylinder Pulse Synthesis
 * - Exhaust Resonator & Lowpass Filtering
 * - Turbo Compressor Spool & Blow-Off Valve
 * - Wet Road / Tire Friction
 * - Master Limiter & Smooth Crossfades
 * - Guaranteed browser audio unlocking on first user interaction
 */

class SupercarSoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.engineGain = null;
    this.turboGain = null;
    this.roadGain = null;
    this.limiter = null;

    // Engine Oscillators
    this.oscFundamental = null;
    this.oscSub = null;
    this.oscHarmonic = null;
    this.engineFilter = null;

    // Turbo
    this.turboNoise = null;
    this.turboFilter = null;
    this.turboTone = null;

    // Road
    this.roadNoise = null;
    this.roadFilter = null;

    this.isInitialized = false;
    this.isPlaying = false;
    this.isMuted = false;

    // Target Gains (Audible but subtle mix)
    this.TARGET_MASTER = 0.32;
    this.TARGET_ENGINE = 0.28;
    this.TARGET_TURBO = 0.12;
    this.TARGET_ROAD = 0.12;

    this.currentRPM = 2200;
    this.targetRPM = 2200;
    this.throttle = 0.35;
  }

  /**
   * Initializes the AudioContext on user interaction
   */
  async init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
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
      this.limiter.threshold.setValueAtTime(-4, this.ctx.currentTime);
      this.limiter.knee.setValueAtTime(8, this.ctx.currentTime);
      this.limiter.ratio.setValueAtTime(8, this.ctx.currentTime);
      this.limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.limiter.release.setValueAtTime(0.15, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(this.TARGET_MASTER, this.ctx.currentTime + 0.3);

      this.masterGain.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);

      // Build Sub-systems
      this._buildEngine();
      this._buildTurbo();
      this._buildRoad();

      this.isInitialized = true;
      this.isPlaying = true;
      this.isMuted = false;

      console.log("[AudioEngine] Supercar Web Audio started successfully (state:", this.ctx.state, ")");
      return true;
    } catch (e) {
      console.warn("[AudioEngine] AudioContext init error:", e);
      return false;
    }
  }

  /**
   * Procedural V8 Engine Sound
   */
  _buildEngine() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(this.TARGET_ENGINE, now);

    // Filter modeling exhaust and engine chamber
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.setValueAtTime(280, now);
    this.engineFilter.Q.setValueAtTime(2.2, now);

    // Fundamental V8 cylinder pulse (Sawtooth)
    this.oscFundamental = this.ctx.createOscillator();
    this.oscFundamental.type = "sawtooth";
    this.oscFundamental.frequency.setValueAtTime(42, now);

    // Deep Sub-rumble (Triangle)
    this.oscSub = this.ctx.createOscillator();
    this.oscSub.type = "triangle";
    this.oscSub.frequency.setValueAtTime(21, now);

    // Higher harmonic pulse (Sawtooth)
    this.oscHarmonic = this.ctx.createOscillator();
    this.oscHarmonic.type = "sawtooth";
    this.oscHarmonic.frequency.setValueAtTime(84, now);

    // Subtle distortion curve for exhaust combustion
    const waveshaper = this.ctx.createWaveShaper();
    waveshaper.curve = this._makeDistortionCurve(18);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.7, now);
    this.oscSub.connect(subGain);

    const harmGain = this.ctx.createGain();
    harmGain.gain.setValueAtTime(0.35, now);
    this.oscHarmonic.connect(harmGain);

    this.oscFundamental.connect(waveshaper);
    subGain.connect(waveshaper);
    harmGain.connect(waveshaper);

    waveshaper.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.oscFundamental.start(now);
    this.oscSub.start(now);
    this.oscHarmonic.start(now);
  }

  /**
   * Turbocharger Spool & Air Intake
   */
  _buildTurbo() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.turboGain = this.ctx.createGain();
    this.turboGain.gain.setValueAtTime(this.TARGET_TURBO * 0.4, now);

    // High Whistle Sine Tone
    this.turboTone = this.ctx.createOscillator();
    this.turboTone.type = "sine";
    this.turboTone.frequency.setValueAtTime(1650, now);

    // Air flow noise buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.turboNoise = this.ctx.createBufferSource();
    this.turboNoise.buffer = noiseBuffer;
    this.turboNoise.loop = true;

    this.turboFilter = this.ctx.createBiquadFilter();
    this.turboFilter.type = "bandpass";
    this.turboFilter.frequency.setValueAtTime(2200, now);
    this.turboFilter.Q.setValueAtTime(4.5, now);

    const toneGain = this.ctx.createGain();
    toneGain.gain.setValueAtTime(0.25, now);
    this.turboTone.connect(toneGain);

    toneGain.connect(this.turboGain);
    this.turboNoise.connect(this.turboFilter);
    this.turboFilter.connect(this.turboGain);

    this.turboGain.connect(this.masterGain);

    this.turboTone.start(now);
    this.turboNoise.start(now);
  }

  /**
   * Road / Tire Surface Contact
   */
  _buildRoad() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.roadGain = this.ctx.createGain();
    this.roadGain.gain.setValueAtTime(this.TARGET_ROAD, now);

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02; // Pink-ish noise
      lastOut = output[i];
    }

    this.roadNoise = this.ctx.createBufferSource();
    this.roadNoise.buffer = noiseBuffer;
    this.roadNoise.loop = true;

    this.roadFilter = this.ctx.createBiquadFilter();
    this.roadFilter.type = "lowpass";
    this.roadFilter.frequency.setValueAtTime(320, now);
    this.roadFilter.Q.setValueAtTime(1.0, now);

    this.roadNoise.connect(this.roadFilter);
    this.roadFilter.connect(this.roadGain);
    this.roadGain.connect(this.masterGain);

    this.roadNoise.start(now);
  }

  /**
   * Distortion curve generator
   */
  _makeDistortionCurve(amount = 20) {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  /**
   * Updates audio parameters smoothly on every frame (rpm, speed, throttle)
   */
  update(delta = 0.016, speed = 32.0, isAccelerating = false) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const targetRPM = isAccelerating ? 4200 : 2600 + Math.sin(now * 1.5) * 220;
    this.currentRPM += (targetRPM - this.currentRPM) * 0.08;

    // 1. Engine frequency modulation (V8: Fundamental = RPM / 60)
    const baseFreq = (this.currentRPM / 60) * 1.15; // ~42 Hz to 80 Hz
    if (this.oscFundamental) {
      this.oscFundamental.frequency.setTargetAtTime(baseFreq, now, 0.04);
    }
    if (this.oscSub) {
      this.oscSub.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.04);
    }
    if (this.oscHarmonic) {
      this.oscHarmonic.frequency.setTargetAtTime(baseFreq * 2.0, now, 0.04);
    }
    if (this.engineFilter) {
      const filterFreq = 220 + (this.currentRPM / 4500) * 260;
      this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.05);
    }

    // 2. Turbo frequency & volume modulation
    if (this.turboTone && this.turboGain && this.turboFilter) {
      const turboWhistleFreq = 1400 + (this.currentRPM / 4500) * 1600;
      this.turboTone.frequency.setTargetAtTime(turboWhistleFreq, now, 0.06);
      this.turboFilter.frequency.setTargetAtTime(turboWhistleFreq * 1.1, now, 0.06);

      const targetTurboGain = this.TARGET_TURBO * (0.35 + (this.currentRPM / 4500) * 0.65);
      this.turboGain.gain.setTargetAtTime(targetTurboGain, now, 0.06);
    }

    // 3. Road noise modulation with speed
    if (this.roadGain && this.roadFilter) {
      const roadFreq = 260 + (speed / 35.0) * 120;
      this.roadFilter.frequency.setTargetAtTime(roadFreq, now, 0.08);
      this.roadGain.gain.setTargetAtTime(this.TARGET_ROAD, now, 0.08);
    }
  }

  /**
   * Toggle Mute / Unmute
   */
  toggleMute() {
    if (!this.isInitialized) {
      this.init();
      return true;
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      const target = this.isMuted ? 0.0001 : this.TARGET_MASTER;
      this.masterGain.gain.linearRampToValueAtTime(target, now + 0.15);
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
      this.masterGain.gain.linearRampToValueAtTime(target, now + 0.15);
    }
  }
}

export const audioManager = new SupercarSoundEngine();
