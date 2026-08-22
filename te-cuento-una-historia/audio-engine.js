const MUSIC_SOURCE_RATE = 44_100;
const CITY_CROSSFADE_SECONDS = 5;
const DEFAULT_MUSIC_CYCLE = Object.freeze({
  loops: 3,
  fadeInSeconds: 2.4,
  fadeOutSeconds: 2.8,
  silenceMinSeconds: 18,
  silenceMaxSeconds: 42,
});

function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 0x1_0000_0000);
}

function makeSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function copyFrames(context, decoded, frameCount) {
  const output = context.createBuffer(
    decoded.numberOfChannels,
    frameCount,
    context.sampleRate,
  );
  for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
    output.copyToChannel(decoded.getChannelData(channel).subarray(0, frameCount), channel);
  }
  return output;
}

// Put the crossfaded seam at the beginning of the buffer and follow it with
// the untouched middle. The end then joins the beginning at the original
// 85s/5s boundary instead of repeating a codec-padded file edge.
function makeAmbientLoop(context, decoded, crossfadeSeconds) {
  const crossfadeFrames = Math.round(crossfadeSeconds * context.sampleRate);
  if (decoded.length <= crossfadeFrames * 2) return decoded;
  const middleStart = crossfadeFrames;
  const middleEnd = decoded.length - crossfadeFrames;
  const outputFrames = decoded.length - crossfadeFrames;
  const output = context.createBuffer(decoded.numberOfChannels, outputFrames, context.sampleRate);

  for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
    const input = decoded.getChannelData(channel);
    const target = output.getChannelData(channel);
    for (let frame = 0; frame < crossfadeFrames; frame += 1) {
      const mix = frame / Math.max(1, crossfadeFrames - 1);
      target[frame] = input[middleEnd + frame] * (1 - mix) + input[frame] * mix;
    }
    target.set(input.subarray(middleStart, middleEnd), crossfadeFrames);
  }
  return output;
}

function makeFilter(context, type, frequency, q = 0.707, gain = 0) {
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  filter.gain.value = gain;
  return filter;
}

export class PopupAudioEngine {
  constructor({ musicTracks, cityUrl, mix, musicCycle = {} }) {
    if (!Array.isArray(musicTracks) || musicTracks.length === 0) {
      throw new Error("Se necesita al menos un loop musical");
    }
    this.musicTracks = musicTracks.map((track, index) => ({
      id: track.id ?? `music-${index + 1}`,
      url: track.url,
      sourceFrames: track.sourceFrames,
      sourceRate: track.sourceRate ?? MUSIC_SOURCE_RATE,
    }));
    this.urls = { cityUrl };
    this.mix = mix;
    const requestedSeed = Number(musicCycle.seed);
    const seed = Number.isFinite(requestedSeed) ? requestedSeed >>> 0 : randomSeed();
    this.musicCycle = {
      ...DEFAULT_MUSIC_CYCLE,
      ...musicCycle,
      seed,
    };
    this.musicCycleRandom = makeSeededRandom(seed);
    this.musicSelectionRandom = makeSeededRandom(seed ^ 0x9E37_79B9);
    this.musicCycleState = null;
    this.musicCycleCount = 0;
    this.musicCycleTimer = 0;
    this.activeMusicTrack = null;
    this.lastMusicIndex = -1;
    this.context = null;
    this.buffers = null;
    this.sources = null;
    this.gains = null;
    this.enabled = true;
    this.started = false;
    this.loading = null;
    this.nodes = [];
    this.destroyed = false;
    this.destroyPromise = null;
    this.abortController = new AbortController();
  }

  async load() {
    if (this.destroyed) throw new DOMException("El motor de audio fue destruido", "AbortError");
    if (this.loading) return this.loading;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio API no está disponible");
    try {
      this.context = new AudioContextClass({
        latencyHint: "playback",
        sampleRate: MUSIC_SOURCE_RATE,
      });
    } catch {
      // Navegadores antiguos pueden no aceptar sampleRate en el constructor.
      // El frame count equivalente conserva la duración exacta de cada loop.
      this.context = new AudioContextClass({ latencyHint: "playback" });
    }
    const loadingContext = this.context;
    const musicRequests = this.musicTracks.map((track) => (
      fetch(track.url, { signal: this.abortController.signal }).then((response) => {
        if (!response.ok) throw new Error(`No se pudo cargar el loop musical: ${track.id}`);
        return response.arrayBuffer();
      })
    ));
    this.loading = Promise.all([
      Promise.all(musicRequests),
      fetch(this.urls.cityUrl, { signal: this.abortController.signal }).then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el ambiente urbano");
        return response.arrayBuffer();
      }),
    ]).then(async ([musicBytes, cityBytes]) => {
      const [decodedMusic, decodedCity] = await Promise.all([
        Promise.all(musicBytes.map((bytes) => this.context.decodeAudioData(bytes))),
        this.context.decodeAudioData(cityBytes),
      ]);
      if (this.destroyed) throw new DOMException("El motor de audio fue destruido", "AbortError");
      const music = decodedMusic.map((decoded, index) => {
        const track = this.musicTracks[index];
        const exactFrames = Math.round(
          track.sourceFrames * this.context.sampleRate / track.sourceRate,
        );
        if (decoded.length < exactFrames) {
          throw new Error(`Loop musical incompleto (${track.id}): ${decoded.length}/${exactFrames} frames`);
        }
        return copyFrames(this.context, decoded, exactFrames);
      });
      this.buffers = {
        music,
        city: makeAmbientLoop(this.context, decodedCity, CITY_CROSSFADE_SECONDS),
      };
      return this.buffers;
    }).catch(async (error) => {
      this.loading = null;
      this.buffers = null;
      if (loadingContext.state !== "closed") {
        await loadingContext.close().catch(() => {});
      }
      if (this.context === loadingContext) this.context = null;
      throw error;
    });
    return this.loading;
  }

  async resume() {
    if (this.context?.state === "suspended") await this.context.resume();
  }

  buildGraph() {
    const context = this.context;
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 2;
    compressor.attack.value = 0.025;
    compressor.release.value = 0.38;
    master.gain.value = 0.92;
    compressor.connect(master).connect(context.destination);

    const musicGain = context.createGain();
    const musicCycleGain = context.createGain();
    const musicHighpass = makeFilter(context, "highpass", 48);
    const musicPresence = makeFilter(context, "peaking", 2_700, 0.9, -1.4);
    const musicLowpass = makeFilter(context, "lowpass", 13_500);
    musicCycleGain.connect(musicGain).connect(musicHighpass).connect(musicPresence).connect(musicLowpass).connect(compressor);

    const cityGain = context.createGain();
    const cityHighpass = makeFilter(context, "highpass", 58);
    const cityBody = makeFilter(context, "peaking", 180, 0.8, 1.8);
    const cityDigitalCut = makeFilter(context, "peaking", 2_900, 0.75, -2.5);
    const cityLowpass = makeFilter(context, "lowpass", 5_800);
    cityGain.connect(cityHighpass).connect(cityBody).connect(cityDigitalCut).connect(cityLowpass).connect(compressor);

    this.gains = { music: musicGain, musicCycle: musicCycleGain, city: cityGain, master };
    this.nodes = [
      master,
      compressor,
      musicGain,
      musicCycleGain,
      musicHighpass,
      musicPresence,
      musicLowpass,
      cityGain,
      cityHighpass,
      cityBody,
      cityDigitalCut,
      cityLowpass,
    ];
  }

  makeLoopSource(buffer) {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.length / buffer.sampleRate;
    return source;
  }

  nextSilenceSeconds() {
    const { silenceMinSeconds, silenceMaxSeconds } = this.musicCycle;
    return silenceMinSeconds
      + this.musicCycleRandom() * (silenceMaxSeconds - silenceMinSeconds);
  }

  nextMusicTrack() {
    const trackCount = this.musicTracks.length;
    let index = 0;
    if (trackCount > 1) {
      if (this.lastMusicIndex < 0) {
        index = Math.floor(this.musicSelectionRandom() * trackCount);
      } else {
        index = Math.floor(this.musicSelectionRandom() * (trackCount - 1));
        if (index >= this.lastMusicIndex) index += 1;
      }
    }
    this.lastMusicIndex = index;
    return {
      index,
      metadata: this.musicTracks[index],
      buffer: this.buffers.music[index],
    };
  }

  scheduleMusicCycle(requestedStart) {
    const context = this.context;
    if (this.destroyed || !this.started || context.state === "closed") return;
    const start = Math.max(requestedStart, context.currentTime + 0.03);
    const track = this.nextMusicTrack();
    const loopSeconds = track.buffer.length / track.buffer.sampleRate;
    const fadeStart = start + loopSeconds * this.musicCycle.loops;
    const fadeEnd = fadeStart + this.musicCycle.fadeOutSeconds;
    const silenceSeconds = this.nextSilenceSeconds();
    const nextStart = fadeEnd + silenceSeconds;
    const source = this.makeLoopSource(track.buffer);
    const envelope = this.gains.musicCycle.gain;

    envelope.cancelScheduledValues(start);
    envelope.setValueAtTime(0, start);
    envelope.linearRampToValueAtTime(1, start + this.musicCycle.fadeInSeconds);
    envelope.setValueAtTime(1, fadeStart);
    envelope.linearRampToValueAtTime(0, fadeEnd);

    source.connect(this.gains.musicCycle);
    source.start(start);
    source.stop(fadeEnd + 0.03);
    this.sources.music = source;
    this.activeMusicTrack = track;
    this.ended.music = false;
    source.onended = () => {
      if (this.sources.music === source) this.ended.music = true;
      source.disconnect();
    };

    this.musicCycleCount += 1;
    this.musicCycleState = {
      count: this.musicCycleCount,
      trackId: track.metadata.id,
      trackIndex: track.index,
      trackUrl: track.metadata.url,
      loopSeconds,
      start,
      fadeInEnd: start + this.musicCycle.fadeInSeconds,
      fullLoopsEnd: fadeStart,
      fadeOutEnd: fadeEnd,
      silenceSeconds,
      nextStart,
    };
    window.clearTimeout(this.musicCycleTimer);
    this.musicCycleTimer = window.setTimeout(() => {
      this.scheduleMusicCycle(nextStart);
    }, Math.max(0, (nextStart - context.currentTime - 0.05) * 1_000));
  }

  async start() {
    if (this.destroyed) throw new DOMException("El motor de audio fue destruido", "AbortError");
    if (this.started) {
      await this.resume();
      return;
    }
    const loading = this.load();
    // resume() ocurre todavía dentro del gesto, aunque el WAV siga cargando.
    // Esto evita perder la autorización de autoplay en Safari/iOS.
    await this.context.resume();
    await loading;
    if (this.context.state !== "running") await this.context.resume();
    this.buildGraph();
    this.sources = {
      music: null,
      city: this.makeLoopSource(this.buffers.city),
    };
    this.sources.city.connect(this.gains.city);
    this.ended = { music: false, city: false };
    this.sources.city.onended = () => { this.ended.city = true; };
    this.gains.music.gain.value = 0;
    this.gains.musicCycle.gain.value = 0;
    this.gains.city.gain.value = 0;
    const when = this.context.currentTime + 0.03;
    this.startedAt = when;
    this.sources.city.start(when);
    this.started = true;
    this.scheduleMusicCycle(when);
  }

  setLevels(levels, duration = 0.8) {
    if (!this.started) return;
    const when = this.context.currentTime;
    for (const id of ["music", "city"]) {
      const parameter = this.gains[id].gain;
      const destination = this.enabled ? levels[id] : 0;
      parameter.cancelScheduledValues(when);
      parameter.setValueAtTime(parameter.value, when);
      if (duration <= 0) parameter.setValueAtTime(destination, when);
      else parameter.linearRampToValueAtTime(destination, when + duration);
    }
  }

  setEnabled(enabled, levels) {
    this.enabled = enabled;
    this.setLevels(levels, 0.45);
  }

  diagnostics() {
    return {
      engine: "Web Audio API",
      state: this.context?.state ?? "uninitialized",
      started: this.started,
      sampleRate: this.context?.sampleRate ?? null,
      sourceFrames: this.activeMusicTrack?.metadata.sourceFrames ?? null,
      musicFrames: this.activeMusicTrack?.buffer.length ?? null,
      musicLoopEnd: this.sources?.music.loopEnd ?? null,
      musicTracks: this.musicTracks.map((track, index) => ({
        id: track.id,
        url: track.url,
        sourceFrames: track.sourceFrames,
        decodedFrames: this.buffers?.music[index]?.length ?? null,
      })),
      cityFrames: this.buffers?.city.length ?? null,
      cityLoopEnd: this.sources?.city.loopEnd ?? null,
      playbackSeconds: this.startedAt == null ? null : Math.max(0, this.context.currentTime - this.startedAt),
      ended: this.ended ?? null,
      gains: this.gains ? {
        music: this.gains.music.gain.value,
        musicCycle: this.gains.musicCycle.gain.value,
        city: this.gains.city.gain.value,
      } : null,
      musicCycle: {
        config: { ...this.musicCycle },
        state: this.musicCycleState ? { ...this.musicCycleState } : null,
      },
      destroyed: this.destroyed,
    };
  }

  async destroy() {
    if (this.destroyPromise) return this.destroyPromise;
    this.destroyed = true;
    this.abortController.abort();
    globalThis.clearTimeout(this.musicCycleTimer);
    this.musicCycleTimer = 0;
    const context = this.context;
    this.destroyPromise = (async () => {
      for (const source of Object.values(this.sources ?? {})) {
        if (!source) continue;
        source.onended = null;
        try { source.stop(); } catch {}
        try { source.disconnect(); } catch {}
      }
      for (const node of this.nodes) {
        try { node.disconnect(); } catch {}
      }
      this.sources = null;
      this.gains = null;
      this.nodes = [];
      this.buffers = null;
      this.musicCycleState = null;
      this.activeMusicTrack = null;
      this.started = false;
      if (context && context.state !== "closed") await context.close().catch(() => {});
      if (this.context === context) this.context = null;
      this.loading = null;
    })();
    return this.destroyPromise;
  }
}
