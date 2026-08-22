import { PopupAudioEngine } from "./audio-engine.js";
import { createPopupRig } from "./rig.js";
import {
  escapeTeCuentoHtml as escapeHtml,
  renderTeCuentoMarkdown,
} from "@/lib/te-cuento-story-markdown";

export async function mountExperience(root, options = {}) {
if (!root?.querySelector) throw new TypeError("mountExperience requiere un nodo raíz");
const document = root.ownerDocument ?? root;
const window = document.defaultView ?? globalThis.window;
const query = options.query instanceof URLSearchParams
  ? options.query
  : new URLSearchParams(options.search ?? window.location.search);
const assetBase = String(options.assetBase ?? "/lab/te-cuento-una-historia").replace(/\/$/u, "");
const storyRouteBase = String(
  options.storyRouteBase
  ?? window.location.pathname.replace(/\/relatos\/[^/]+\/?$/u, ""),
).replace(/\/$/u, "");
const lifecycle = new AbortController();
const { signal } = lifecycle;
const stateRoot = root === document ? document.documentElement : root;
const listen = (target, type, listener, eventOptions = {}) => {
  target.addEventListener(type, listener, { ...eventOptions, signal });
};
const required = (selector) => {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Falta el elemento requerido ${selector}`);
  return element;
};
const resourcePath = (value) => value
  .replace(/^\.\//u, "")
  .split("/")
  .map((segment) => encodeURIComponent(segment))
  .join("/");
const assetUrl = (value) => {
  if (/^(?:[a-z]+:)?\/\//iu.test(value) || value.startsWith("data:") || value.startsWith("blob:")) return value;
  return `${assetBase}/${resourcePath(value)}`;
};
const panViewport = required("#pan-viewport");
const stage = required("#stage");
const clueLayer = required("#clue-layer");
const reader = required("#reader");
const readerBody = required("#reader-body");
const readerMeta = required("#reader-meta");
const readerTitle = required("#reader-title");
const readerPage = required("#reader-page");
const readerArticle = required("#reader-article");
const readerIllustrationWrap = required("#reader-illustration-wrap");
const readerIllustration = required("#reader-illustration");
const closeReader = required("#reader-close");
const soundToggle = required("#sound-toggle");
const creditsToggle = required("#credits-toggle");
const credits = required("#credits");
const creditsPanel = required("#credits-panel");
const creditsClose = required("#credits-close");
const authorMark = required("#author-mark");
const intro = required("#intro");
const introEnter = required("#intro-enter");
const introLogo = required("#intro-logo");
const introLogoMotion = required("#intro-logo-motion");
const sceneLogo = required("#scene-logo");
const debugAudio = required("#debug-audio");
const debugMusicVolume = required("#debug-music-volume");
const debugMusicValue = required("#debug-music-value");
const debugCityVolume = required("#debug-city-volume");
const debugCityValue = required("#debug-city-value");
panViewport.inert = true;
soundToggle.inert = true;
creditsToggle.inert = true;
reader.inert = true;
credits.inert = true;
const debugMode = query.get("debugHotspots") === "1";
const audioSeed = query.get("audioSeed");
const initialStorySlug = storySlugFromPath();
const bypassIntro = query.get("autoplay") === "1" || debugMode || initialStorySlug !== null;
const discovered = new Set();
const CACHE = new Map();
const ILLUSTRATION_REVISION = "20260818-illustration-redesign-agent-v1";
let STORIES = [];
let MASTER = { width: 1920, height: 1200 };
let wasOpen = false;
let readerReturnTarget = null;
let creditsReturnTarget = null;
let stateFrame = 0;
let sceneFrame = 0;
let sceneSwitchToken = 0;
let activeStory = null;
let activeSceneId = "opener";
const MIX = Object.freeze({
  scene: { music: 0.02, city: 0.05 },
  reader: { music: 0.02, city: 0.05 },
});
const SILENT_MIX = Object.freeze({ music: 0, city: 0 });
const audioEngine = new PopupAudioEngine({
  musicTracks: [
    {
      id: "pablo",
      url: assetUrl("assets/audio/pablo-loop-source-447615f-44100.mp3"),
      sourceFrames: 447_615,
      sourceRate: 44_100,
    },
    {
      id: "climax",
      url: assetUrl("assets/audio/climax-loop-source-403956f-44100.mp3"),
      sourceFrames: 403_956,
      sourceRate: 44_100,
    },
  ],
  cityUrl: assetUrl("assets/audio/city-traffic-walla-horns-v003.mp3"),
  mix: MIX,
  musicCycle: audioSeed == null ? {} : { seed: Number(audioSeed) },
});
let soundEnabled = true;
let soundStarted = false;
let soundFade = 0;
let videoAudioDucked = false;
let youtubeApiPromise = null;
let mediaSessionToken = 0;
let activeMediaPlayer = null;
const mediaPlayers = new Set();
let rig = null;
let destroyed = false;
let entering = false;
let logoAnimation = null;

function storyPath(slug) {
  return `${storyRouteBase}/relatos/${encodeURIComponent(slug)}` || `/relatos/${encodeURIComponent(slug)}`;
}

function storySlugFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/\/relatos\/([^/]+)\/?$/u);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function writeStoryHistory(story, mode) {
  if (mode === "none" || storySlugFromPath() === story.slug) return;
  const state = {
    ...(window.history.state ?? {}),
    teCuentoStory: story.slug,
  };
  const method = mode === "replace" ? "replaceState" : "pushState";
  window.history[method](state, "", storyPath(story.slug));
}

function formatDate(value) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function resourceUrl(value) {
  return assetUrl(value);
}

function illustrationUrl(value) {
  return `${resourceUrl(value)}?v=${ILLUSTRATION_REVISION}`;
}

async function loadStories() {
  const [corpusResponse, hotspotsResponse, scenesResponse, mediaResponse] = await Promise.all([
    fetch(assetUrl("data/corpus.json"), { signal }),
    fetch(assetUrl("data/hotspots.json"), { signal }),
    fetch(assetUrl("data/story-scenes.json"), { signal }),
    fetch(assetUrl("data/story-media.json"), { signal }),
  ]);
  if (!corpusResponse.ok || !hotspotsResponse.ok || !scenesResponse.ok || !mediaResponse.ok) {
    throw new Error("No se pudo cargar el mapa de historias");
  }
  const [corpus, hotspots, storyScenes, storyMedia] = await Promise.all([
    corpusResponse.json(),
    hotspotsResponse.json(),
    scenesResponse.json(),
    mediaResponse.json(),
  ]);
  MASTER = hotspots.master;
  const entriesBySlug = new Map(corpus.entries.map((entry) => [entry.slug, entry]));
  const scenesBySlug = new Map(storyScenes.entries.map((entry) => [entry.slug, entry.scenes]));
  const mediaBySlug = new Map(storyMedia.entries.map((entry) => [entry.slug, entry]));
  STORIES = hotspots.entries.map((hotspot) => {
    const entry = entriesBySlug.get(hotspot.slug);
    if (!entry) throw new Error(`Hotspot sin historia: ${hotspot.slug}`);
    const illustrationVariant = entry.illustrationVariant ?? "ink";
    const illustrationPath = entry.illustrations[illustrationVariant];
    if (!illustrationPath) throw new Error(`Variante de ilustración inválida: ${entry.slug}/${illustrationVariant}`);
    return {
      ...hotspot,
      order: entry.order,
      title: entry.title,
      date: formatDate(entry.date),
      dateValue: entry.date.slice(0, 10),
      form: entry.form ?? "cuento",
      file: resourceUrl(entry.file),
      illustration: illustrationUrl(illustrationPath),
      illustrationAlt: entry.illustrationAlt ?? `Ilustración de ${entry.title}`,
      scenes: (scenesBySlug.get(entry.slug) ?? []).map((scene) => ({
        ...scene,
        src: illustrationUrl(scene.src),
      })),
      media: mediaBySlug.get(entry.slug) ?? null,
    };
  });
}

const storiesReady = loadStories();

function setSoundLevel(levels, duration = 0.8) {
  if (!soundStarted) return;
  window.clearTimeout(soundFade);
  audioEngine.setLevels(levels, duration);
}

function activeMix() {
  return reader.classList.contains("is-open") ? MIX.reader : MIX.scene;
}

function setVideoAudioDucked(ducked) {
  if (videoAudioDucked === ducked) return;
  videoAudioDucked = ducked;
  setSoundLevel(ducked ? SILENT_MIX : activeMix(), ducked ? 0.32 : 0.9);
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    let settled = false;
    const previousReady = window.onYouTubeIframeAPIReady;
    let installedReady = null;
    const handleAbort = () => finish(reject, new DOMException("Carga cancelada", "AbortError"));
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", handleAbort);
      if (window.onYouTubeIframeAPIReady === installedReady) {
        window.onYouTubeIframeAPIReady = previousReady;
      }
      callback(value);
    };
    const poll = window.setInterval(() => {
      if (window.YT?.Player) finish(resolve, window.YT);
    }, 50);
    const timeout = window.setTimeout(() => {
      finish(reject, new Error("La API de video no respondió"));
    }, 15_000);

    installedReady = () => {
      try {
        if (typeof previousReady === "function") previousReady();
      } finally {
        if (window.YT?.Player) finish(resolve, window.YT);
      }
    };
    window.onYouTubeIframeAPIReady = installedReady;
    signal.addEventListener("abort", handleAbort, { once: true });

    if (!document.querySelector("script[data-youtube-iframe-api]")) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.youtubeIframeApi = "true";
      script.addEventListener("error", () => {
        finish(reject, new Error("No se pudo cargar la API de video"));
      }, { once: true, signal });
      document.head.append(script);
    }
  }).catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });

  return youtubeApiPromise;
}

function handleMediaState(event, token) {
  if (token !== mediaSessionToken) return;
  const states = window.YT?.PlayerState ?? { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
  if (event.data === states.PLAYING) {
    activeMediaPlayer = event.target;
    for (const player of mediaPlayers) {
      if (player !== activeMediaPlayer) player.pauseVideo?.();
    }
    setVideoAudioDucked(true);
    return;
  }
  if (event.data === states.BUFFERING) {
    activeMediaPlayer = event.target;
    setVideoAudioDucked(true);
    return;
  }
  if (event.target === activeMediaPlayer && [states.ENDED, states.PAUSED, states.CUED].includes(event.data)) {
    activeMediaPlayer = null;
    setVideoAudioDucked(false);
  }
}

function teardownStoryMedia() {
  mediaSessionToken += 1;
  const wasDucked = videoAudioDucked;
  videoAudioDucked = false;
  activeMediaPlayer = null;
  for (const player of mediaPlayers) {
    try { player.stopVideo?.(); } catch {}
    try { player.destroy?.(); } catch {}
  }
  mediaPlayers.clear();
  return wasDucked;
}

async function initStoryMedia(token) {
  const frames = [...readerBody.querySelectorAll(".reader-media iframe")];
  if (!frames.length) return;
  try {
    const YT = await loadYouTubeApi();
    if (token !== mediaSessionToken || !reader.classList.contains("is-open")) return;
    for (const frame of frames) {
      const player = new YT.Player(frame, {
        events: {
          onStateChange: (event) => handleMediaState(event, token),
          onError: (event) => {
            if (token !== mediaSessionToken || event.target !== activeMediaPlayer) return;
            activeMediaPlayer = null;
            setVideoAudioDucked(false);
          },
        },
      });
      mediaPlayers.add(player);
    }
  } catch (error) {
    console.warn(error.message);
  }
}

function setDebugVolume(channel, percent) {
  const value = Math.min(1, Math.max(0, Number(percent) / 100));
  MIX.scene[channel] = value;
  MIX.reader[channel] = value;
  const output = channel === "music" ? debugMusicValue : debugCityValue;
  output.textContent = `${Math.round(value * 100)}%`;
  if (!soundStarted && soundEnabled) startSoundtrack();
  else setSoundLevel(videoAudioDucked ? SILENT_MIX : activeMix(), 0.08);
}

function initDebugAudio() {
  if (!debugMode) return;
  debugMusicVolume.value = String(Math.round(MIX.scene.music * 100));
  debugCityVolume.value = String(Math.round(MIX.scene.city * 100));
  debugMusicValue.textContent = `${debugMusicVolume.value}%`;
  debugCityValue.textContent = `${debugCityVolume.value}%`;
  debugAudio.hidden = false;
  listen(debugMusicVolume, "input", () => setDebugVolume("music", debugMusicVolume.value));
  listen(debugCityVolume, "input", () => setDebugVolume("city", debugCityVolume.value));
}

function startSoundtrack() {
  if (soundStarted) return;
  soundStarted = true;
  audioEngine.start().then(() => {
    soundFade = window.setTimeout(() => {
      setSoundLevel(videoAudioDucked ? SILENT_MIX : activeMix(), 1.8);
    }, 0);
  }).catch(() => {
    soundStarted = false;
    soundToggle.textContent = soundToggle.dataset.retryLabel ?? "Activar sonido";
    soundToggle.setAttribute("aria-pressed", "false");
  });
}

async function storyHtml(story) {
  if (!CACHE.has(story.slug)) {
    const request = fetch(story.file, { signal })
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudo leer ${story.title}`);
        return response.text();
      })
      .then((markdown) => renderTeCuentoMarkdown(markdown, story, {
        mediaOrigin: window.location.origin,
        storyRouteBase,
      }));
    CACHE.set(story.slug, request);
  }
  return CACHE.get(story.slug);
}

function setSceneInert(inert) {
  panViewport.inert = inert;
  soundToggle.inert = inert;
  creditsToggle.inert = inert;
}

function openCredits() {
  if (credits.classList.contains("is-open")) return;
  creditsReturnTarget = creditsToggle;
  setSceneInert(true);
  credits.classList.add("is-open");
  credits.setAttribute("aria-hidden", "false");
  credits.inert = false;
  creditsClose.focus({ preventScroll: true });
}

function closeCredits() {
  if (!credits.classList.contains("is-open")) return;
  credits.classList.remove("is-open");
  credits.setAttribute("aria-hidden", "true");
  credits.inert = true;
  setSceneInert(false);
  const returnTarget = creditsReturnTarget?.isConnected ? creditsReturnTarget : creditsToggle;
  creditsReturnTarget = null;
  returnTarget.focus({ preventScroll: true });
}

function close({ historyMode = "back" } = {}) {
  if (historyMode === "back" && storySlugFromPath()) {
    if (window.history.state?.teCuentoStory) {
      window.history.back();
      return;
    }
    window.history.replaceState(window.history.state, "", storyRouteBase || "/");
  }
  const restoreBackgroundAudio = teardownStoryMedia();
  activeStory = null;
  sceneSwitchToken += 1;
  reader.classList.remove("is-open");
  reader.setAttribute("aria-hidden", "true");
  reader.inert = true;
  readerArticle.classList.remove("has-scene-sequence");
  if (restoreBackgroundAudio) setSoundLevel(MIX.scene, 0.9);
  setSceneInert(false);
  const returnTarget = readerReturnTarget?.isConnected ? readerReturnTarget : stage;
  readerReturnTarget = null;
  returnTarget.focus({ preventScroll: true });
}

function setReaderIllustration(src, alt, { immediate = false } = {}) {
  const token = ++sceneSwitchToken;
  if (immediate) {
    readerIllustration.src = src;
    readerIllustration.alt = alt;
    readerIllustration.classList.remove("is-switching");
    return;
  }
  const preload = new Image();
  preload.src = src;
  const ready = typeof preload.decode === "function"
    ? preload.decode()
    : new Promise((resolve, reject) => {
      preload.addEventListener("load", resolve, { once: true, signal });
      preload.addEventListener("error", reject, { once: true, signal });
    });
  readerIllustration.classList.add("is-switching");
  ready.catch(() => {}).then(() => {
    if (token !== sceneSwitchToken || !activeStory) return;
    readerIllustration.src = src;
    readerIllustration.alt = alt;
    requestAnimationFrame(() => {
      if (!destroyed) readerIllustration.classList.remove("is-switching");
    });
  });
}

function updateStoryScene() {
  if (!activeStory?.scenes.length) return;
  const compact = window.matchMedia("(max-aspect-ratio: 6 / 5), (max-width: 760px)").matches;
  const pageRect = readerPage.getBoundingClientRect();
  const triggerLine = compact
    ? readerIllustrationWrap.getBoundingClientRect().bottom + Math.min(44, reader.clientHeight * 0.055)
    : pageRect.top + pageRect.height * 0.38;
  let selected = null;
  for (const marker of readerBody.querySelectorAll("[data-scene-id]")) {
    if (marker.getBoundingClientRect().top <= triggerLine) selected = marker.dataset.sceneId;
  }
  const nextId = selected ?? "opener";
  if (nextId === activeSceneId) return;
  activeSceneId = nextId;
  const scene = activeStory.scenes.find((item) => item.id === nextId);
  setReaderIllustration(
    scene?.src ?? activeStory.illustration,
    scene?.alt ?? `Ilustración de ${activeStory.title}`,
  );
}

function queueSceneUpdate() {
  cancelAnimationFrame(sceneFrame);
  sceneFrame = requestAnimationFrame(updateStoryScene);
}

async function openStory(story, trigger = null, { historyMode = "push" } = {}) {
  // The reader is a stable editorial plane. Any parallax follow-through ends
  // before it opens so decorative motion never continues behind the text.
  rig?.resetPopupMotion();
  const restoreBackgroundAudio = teardownStoryMedia();
  const mediaToken = mediaSessionToken;
  activeStory = story;
  writeStoryHistory(story, historyMode);
  activeSceneId = "opener";
  readerReturnTarget = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  discovered.add(story.slug);
  clueLayer.querySelector(`[data-story="${story.slug}"]`)?.classList.add("is-discovered");
  readerMeta.textContent = story.date;
  readerMeta.dateTime = story.dateValue;
  readerTitle.textContent = story.title;
  const titleLength = [...story.title].length;
  readerArticle.dataset.titleLength = titleLength >= 60 ? "long" : (titleLength >= 36 ? "medium" : "short");
  readerArticle.dataset.form = story.form;
  readerBody.dataset.form = story.form;
  readerArticle.classList.toggle("has-scene-sequence", story.scenes.length > 0);
  setReaderIllustration(story.illustration, story.illustrationAlt, { immediate: true });
  for (const scene of story.scenes) {
    const preload = new Image();
    preload.src = scene.src;
  }
  readerBody.innerHTML = "<p class=\"reader-loading\">Abriendo…</p>";
  setSceneInert(true);
  reader.classList.add("is-open");
  reader.setAttribute("aria-hidden", "false");
  reader.inert = false;
  if (restoreBackgroundAudio) setSoundLevel(MIX.reader, 0.9);
  try {
    const html = await storyHtml(story);
    if (mediaToken !== mediaSessionToken || activeStory !== story) return;
    readerBody.innerHTML = html;
  } catch (error) {
    if (mediaToken !== mediaSessionToken || activeStory !== story) return;
    readerBody.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
  reader.scrollTop = 0;
  readerPage.scrollTop = 0;
  initStoryMedia(mediaToken);
  queueSceneUpdate();
  closeReader.focus({ preventScroll: true });
}

function positionClues() {
  const canvas = stage.querySelector("canvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const minimumTarget = 44;
  for (const story of STORIES) {
    const clue = clueLayer.querySelector(`[data-story="${story.slug}"]`);
    if (!clue) continue;
    const motionOffset = rig?.reactionScreenOffset(story.reactions) ?? { x: 0, y: 0 };
    const centerX = rect.left + (story.x / MASTER.width) * rect.width + motionOffset.x;
    const centerY = rect.top + (story.y / MASTER.height) * rect.height + motionOffset.y;
    const width = Math.max((story.width / MASTER.width) * rect.width, minimumTarget);
    const height = Math.max((story.height / MASTER.height) * rect.height, minimumTarget);
    clue.style.left = `${centerX - width / 2}px`;
    clue.style.top = `${centerY - height / 2}px`;
    clue.style.width = `${width}px`;
    clue.style.height = `${height}px`;
  }
}

function centerPortraitBook() {
  if (!window.matchMedia("(max-aspect-ratio: 6 / 5)").matches) {
    stage.scrollLeft = 0;
    return;
  }
  stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
}

function buildClues() {
  const debug = new URLSearchParams(window.location.search).get("debugHotspots") === "1";
  for (const story of STORIES) {
    const clue = document.createElement("a");
    clue.className = "clue";
    clue.href = storyPath(story.slug);
    clue.dataset.story = story.slug;
    clue.dataset.reactions = story.reactions.join(" ");
    const haloPeriod = 38 + (story.order % 10) * 2.35;
    clue.style.setProperty("--halo-period", `${haloPeriod.toFixed(2)}s`);
    clue.style.setProperty("--halo-delay", `${-((story.order * 5.83) % haloPeriod).toFixed(2)}s`);
    clue.tabIndex = -1;
    clue.setAttribute("aria-disabled", "true");
    clue.setAttribute("aria-hidden", "true");
    clue.setAttribute("aria-label", story.title);
    clue.innerHTML = `<span>${debug ? story.order : story.title}</span>`;
    if (debug) clue.classList.add("is-debug");
    listen(clue, "click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      rig?.setPopupReactions(story.reactions, 0);
      openStory(story, clue);
    });
    listen(clue, "pointerenter", () => rig?.setPopupReactions(story.reactions, 1));
    listen(clue, "pointerleave", () => rig?.setPopupReactions(story.reactions, 0));
    listen(clue, "focus", () => rig?.setPopupReactions(story.reactions, 1));
    listen(clue, "blur", () => rig?.setPopupReactions(story.reactions, 0));
    clueLayer.append(clue);
  }
  centerPortraitBook();
  positionClues();
}

function syncState(watchOpening = false) {
  const time = rig?.state?.timeMs ?? 0;
  const open = time >= 1900;
  stateRoot.classList.toggle("book-is-open", open);
  authorMark.setAttribute("aria-hidden", open ? "true" : "false");
  if (open !== wasOpen) {
    stage.tabIndex = open ? -1 : 0;
    stage.setAttribute("aria-label", open
      ? "¿Te cuento una historia? Libro pop-up porteño abierto"
      : "Abrir ¿Te cuento una historia? Libro pop-up porteño");
    stage.setAttribute("aria-disabled", open ? "true" : "false");
    for (const clue of clueLayer.querySelectorAll(".clue")) {
      clue.tabIndex = open ? 0 : -1;
      clue.setAttribute("aria-disabled", String(!open));
      clue.setAttribute("aria-hidden", open ? "false" : "true");
    }
    positionClues();
    wasOpen = open;
  }
  if (watchOpening && !open) {
    stateFrame = requestAnimationFrame(() => syncState(true));
  } else {
    stateFrame = 0;
  }
}

function beginOpening() {
  if ((rig?.state?.timeMs ?? 0) >= 1900) return;
  stateRoot.classList.add("book-is-opening");
  startSoundtrack();
  if (!stateFrame) syncState(true);
}

function settleIntro() {
  stateRoot.classList.add("logo-is-settled");
  intro.classList.remove("is-transitioning");
  intro.classList.add("is-dismissed");
  intro.setAttribute("aria-hidden", "true");
  intro.inert = true;
  setSceneInert(false);
  stage.focus({ preventScroll: true });
}

async function enterExperience() {
  if (entering) return;
  entering = true;
  introEnter.disabled = true;
  beginOpening();
  rig?.play();

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || typeof introLogoMotion.animate !== "function") {
    settleIntro();
    return;
  }

  const origin = introLogo.getBoundingClientRect();
  const destination = sceneLogo.getBoundingClientRect();
  const translateX = destination.left - origin.left;
  const translateY = destination.top - origin.top;
  const scale = origin.width > 0 ? destination.width / origin.width : 1;

  intro.classList.add("is-transitioning");
  logoAnimation = introLogoMotion.animate([
    { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
    {
      transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
      opacity: 1,
    },
  ], {
    duration: 640,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    fill: "forwards",
  });

  try {
    await logoAnimation.finished;
  } catch {
    // Cancellation is expected during unmount; the lifecycle guard prevents settling.
  }
  if (!destroyed) settleIntro();
}

listen(panViewport, "click", (event) => {
  if (event.target instanceof Element && event.target.closest("a, button")) return;
  if (!rig?.bookPointerHit(event)) return;
  beginOpening();
});
listen(introEnter, "click", enterExperience);
listen(closeReader, "click", () => close());
listen(creditsToggle, "click", openCredits);
listen(creditsClose, "click", closeCredits);
listen(credits, "click", (event) => {
  const target = event.target;
  if (target instanceof Node && !creditsPanel.contains(target)) closeCredits();
});
listen(reader, "click", (event) => {
  const target = event.target;
  if (!(target instanceof Node) || closeReader.contains(target)) return;
  if (!readerArticle.contains(target)) close();
});
listen(readerBody, "click", (event) => {
  const link = event.target instanceof Element ? event.target.closest("[data-story-link]") : null;
  if (!link) return;
  event.preventDefault();
  const linkedStory = STORIES.find((story) => story.slug === link.dataset.storyLink);
  if (linkedStory) openStory(linkedStory, readerReturnTarget);
});
listen(window, "popstate", async () => {
  await storiesReady;
  if (destroyed) return;
  const slug = storySlugFromPath();
  const story = slug ? STORIES.find((item) => item.slug === slug) : null;
  if (story) {
    openStory(story, readerReturnTarget, { historyMode: "none" });
  } else if (reader.classList.contains("is-open")) {
    close({ historyMode: "none" });
  }
});
listen(readerPage, "scroll", queueSceneUpdate, { passive: true });
listen(reader, "scroll", queueSceneUpdate, { passive: true });
listen(soundToggle, "click", () => {
  soundEnabled = !soundEnabled;
  audioEngine.enabled = soundEnabled;
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  soundToggle.textContent = soundEnabled
    ? (soundToggle.dataset.onLabel ?? "Sonido")
    : (soundToggle.dataset.offLabel ?? "Sin sonido");
  if (soundEnabled && !soundStarted) startSoundtrack();
  else {
    if (soundEnabled) audioEngine.resume().catch(() => {});
    setSoundLevel(videoAudioDucked ? SILENT_MIX : activeMix(), 0.45);
  }
});
listen(document, "visibilitychange", () => {
  if (!document.hidden && soundEnabled && soundStarted) {
    audioEngine.resume().catch(() => {});
  }
});
listen(window, "resize", queueSceneUpdate, { passive: true });
listen(window, "keydown", (event) => {
  if (event.key === "Escape" && credits.classList.contains("is-open")) {
    event.preventDefault();
    closeCredits();
    return;
  }
  if (event.key === "Escape" && reader.classList.contains("is-open")) close();
  if (event.key === "Tab" && !intro.classList.contains("is-dismissed")) {
    const focusable = [...intro.querySelectorAll("button:not([disabled]), a[href], [tabindex]:not([tabindex=\"-1\"])")]
      .filter((element) => !element.inert && !element.closest("[inert]"));
    if (focusable.length === 0) return;
    const currentIndex = focusable.indexOf(document.activeElement);
    const direction = event.shiftKey ? -1 : 1;
    const nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + direction + focusable.length) % focusable.length;
    event.preventDefault();
    focusable[nextIndex].focus({ preventScroll: true });
    return;
  }
  if (event.key === "Tab" && reader.classList.contains("is-open")) {
    const focusable = [...reader.querySelectorAll("button:not([disabled]), a[href], [tabindex]:not([tabindex=\"-1\"])")]
      .filter((element) => !element.hidden);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  if (event.key === "Tab" && credits.classList.contains("is-open")) {
    const focusable = [...credits.querySelectorAll("button:not([disabled]), a[href], [tabindex]:not([tabindex=\"-1\"])")]
      .filter((element) => !element.inert && !element.closest("[inert]"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  if ((event.key === "Enter" || event.key === " ") && document.activeElement === stage && (rig?.state?.timeMs ?? 0) < 1900) {
    event.preventDefault();
    beginOpening();
    rig?.play();
  }
});
listen(window, "resize", () => {
  requestAnimationFrame(() => {
    if (destroyed) return;
    centerPortraitBook();
    positionClues();
  });
});
listen(stage, "scroll", positionClues, { passive: true });
listen(window, "popup-parallax-frame", positionClues);
initDebugAudio();
try {
  rig = await createPopupRig({
    root,
    stage,
    reader,
    query,
    assetBase,
    exposeCaptureHooks: options.exposeCaptureHooks === true,
  });
  if (destroyed) {
    rig.destroy();
    throw new DOMException("La experiencia se desmontó durante la inicialización", "AbortError");
  }
  // Decode before the first gesture so opening never waits for network. The
  // AudioContext may remain suspended until start() resumes it from the click.
  audioEngine.load().catch(() => {});
  await storiesReady;
  if (destroyed) throw new DOMException("La experiencia se desmontó durante la inicialización", "AbortError");
  buildClues();
  syncState(bypassIntro);
  if (bypassIntro) {
    stateRoot.classList.add("logo-is-settled");
    intro.classList.add("is-dismissed");
    intro.setAttribute("aria-hidden", "true");
    intro.inert = true;
    setSceneInert(false);
  } else {
    introEnter.disabled = false;
    introEnter.focus({ preventScroll: true });
  }
  if (initialStorySlug) {
    const initialStory = STORIES.find((story) => story.slug === initialStorySlug);
    if (initialStory) await openStory(initialStory, stage, { historyMode: "none" });
  }
} catch (error) {
  lifecycle.abort();
  rig?.destroy();
  await audioEngine.destroy();
  throw error;
}

const popupV002 = {
  get stories() { return STORIES; },
  discovered,
  openStory,
  close,
  mediaDiagnostics: () => ({
    players: mediaPlayers.size,
    active: activeMediaPlayer !== null,
    backgroundDucked: videoAudioDucked,
    session: mediaSessionToken,
  }),
};
const popupAudio = {
  engine: audioEngine,
  mix: MIX,
  get enabled() { return soundEnabled; },
  get started() { return soundStarted; },
  diagnostics: () => audioEngine.diagnostics(),
};

if (options.exposeCaptureHooks) {
  window.__popupV002 = popupV002;
  window.__popupAudio = popupAudio;
}

async function destroy() {
  if (destroyed) return;
  destroyed = true;
  lifecycle.abort();
  window.clearTimeout(soundFade);
  cancelAnimationFrame(stateFrame);
  cancelAnimationFrame(sceneFrame);
  logoAnimation?.cancel();
  logoAnimation = null;
  stateFrame = 0;
  sceneFrame = 0;
  teardownStoryMedia();
  activeStory = null;
  clueLayer.replaceChildren();
  stateRoot.classList.remove("book-is-open", "book-is-opening", "logo-is-settled");
  rig?.destroy();
  rig = null;
  await audioEngine.destroy();
  if (options.exposeCaptureHooks) {
    if (window.__popupV002 === popupV002) delete window.__popupV002;
    if (window.__popupAudio === popupAudio) delete window.__popupAudio;
  }
}

return Object.freeze({
  destroy,
  openStory,
  closeStory: close,
  openCredits,
  closeCredits,
  get stories() { return STORIES; },
  get diagnostics() {
    return {
      audio: audioEngine.diagnostics(),
      rig: rig?.diagnostics ?? null,
      destroyed,
    };
  },
});
}
