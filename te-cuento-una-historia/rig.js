import * as THREE from "three";
/* eslint-disable @typescript-eslint/no-unused-vars -- This recovered fidelity rig intentionally retains named construction handles and dormant diagnostic builders; removing them during framework integration risks changing side-effectful assembly order. */

export async function createPopupRig(options = {}) {
const root = options.root ?? globalThis.document;
const document = root.ownerDocument ?? root;
const window = document.defaultView ?? globalThis.window;
const stage = options.stage ?? root.querySelector?.("#stage");
if (!(stage instanceof window.HTMLElement)) {
  throw new Error("No se encontró el escenario de Te cuento una historia");
}
const reader = options.reader ?? root.querySelector?.("#reader");
const params = options.query instanceof URLSearchParams
  ? options.query
  : new URLSearchParams(options.search ?? window.location.search);
const assetBase = String(options.assetBase ?? "/lab/te-cuento-una-historia").replace(/\/$/u, "");
const lifecycle = new AbortController();
const { signal } = lifecycle;
const hooks = Object.create(null);
const listen = (target, type, listener, eventOptions = {}) => {
  target.addEventListener(type, listener, { ...eventOptions, signal });
};
const resolveAsset = (path) => {
  if (/^(?:[a-z]+:)?\/\//iu.test(path) || path.startsWith("data:") || path.startsWith("blob:")) return path;
  return `${assetBase}/${path.replace(/^\.\//u, "")}`;
};

const WIDTH = 1920;
const HEIGHT = 1200;
const ACTION_DURATION_MS = 1900;
const INTERACTIVE_OPEN_DURATION_S = 1.25;
const CAPTURE_FRAMES = 60;
const CAPTURE_FPS = 24;
const PAGE_THICKNESS = 54;
const COVER_THICKNESS = 10;
const INNER_PAGE_EXPOSURE_DEG = 2;
const CITY_WIDTH_SCALE = 0.78;
const CITY_HEIGHT_SCALE = 0.72;
const PAGE_DEPTH_WORLD = 1285;
const COLOR_BUNDLE_ROOT = "fidelity-v05-color-a9159c172d60";

const clayMode = params.get("mode") === "clay";
const viewMode = params.get("view") === "side" ? "side" : "hero";
const runtimeMode = true;
const isolateIds = new Set((params.get("isolate") ?? "").split(",").filter(Boolean));
// PSD paint order is a contract for the authored hero composition. Side/clay
// diagnostics deliberately keep unmodified physical depth so the construction
// remains inspectable and cannot be made to look valid by the fidelity pass.
const psdOrderMode = viewMode === "hero" && !clayMode && params.get("psdOrder") !== "0";
// The interactive experience must always use the PSD-faithful physical rig.
// Leaving this behind a review-only query parameter made `?runtime=1` fall
// back to the obsolete flat/partial popup assembly.
const hybridSpike = runtimeMode || params.get("hybrid") === "1";

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  // In the experience runtime the desk and its props are responsive DOM
  // layers. WebGL owns only the physical book/city, so its clear must remain
  // transparent. Review/capture modes preserve the approved PSD composite.
  alpha: runtimeMode,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// v0.5 treats the PSD-derived bitmaps as display-referred artwork.  Physical
// paper and hardware still use a scene-referred pipeline, but the previous
// ACES + 1.18 pass re-graded an already graded image and crushed the desk.
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = clayMode ? 1.05 : 1.0;
renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.autoClear = false;
renderer.setClearColor(0x000000, runtimeMode ? 0 : 1);
renderer.domElement.setAttribute("aria-hidden", "true");
stage.appendChild(renderer.domElement);

const backgroundScene = new THREE.Scene();
const overlayScene = new THREE.Scene();
const screenCamera = new THREE.OrthographicCamera(0, WIDTH, HEIGHT, 0, -10, 10);
screenCamera.position.z = 1;

const scene = new THREE.Scene();
scene.background = null;

// The approved desk composite uses a fixed hero calibration camera. Its
// aspect is intentionally independent of the review canvas: the PSD book
// contour is the lens authority, while the screen-space desk remains on its
// own orthographic plane. This camera is fixed for the entire shot so every
// physical deprojection shares the same projection during opening and review.
const heroCamera = new THREE.PerspectiveCamera(
  hybridSpike ? 30.147 : 29.9,
  hybridSpike ? 1.6456 : WIDTH / HEIGHT,
  1,
  7000,
);
heroCamera.position.set(hybridSpike ? -9.5 : 0, hybridSpike ? 1766.4 : 1785, 2099);
heroCamera.lookAt(hybridSpike ? -9.5 : 0, hybridSpike ? 5.4 : 24, 0);

const sideCamera = new THREE.PerspectiveCamera(38, WIDTH / HEIGHT, 1, 6000);
sideCamera.position.set(2350, 420, 0);
sideCamera.lookAt(0, 185, 0);

const camera = viewMode === "side" ? sideCamera : heroCamera;

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");

function configureTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

async function loadTexture(path) {
  return configureTexture(await textureLoader.loadAsync(resolveAsset(path)));
}

function screenPlane(texture, options = {}) {
  const geometry = new THREE.PlaneGeometry(WIDTH, HEIGHT);
  const material = new THREE.MeshBasicMaterial({
    map: texture ?? null,
    color: options.color ?? 0xffffff,
    transparent: options.transparent ?? true,
    opacity: options.opacity ?? 1,
    depthTest: false,
    depthWrite: false,
    // Desktop, props and vignette are slices of the approved composite.  They
    // must recombine without a second filmic curve.
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(WIDTH / 2, HEIGHT / 2, options.z ?? 0);
  return mesh;
}

function solidMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.9,
    metalness: options.metalness ?? 0,
    side: options.side ?? THREE.DoubleSide,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

function texturedMaterial(texture, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0,
    side: options.side ?? THREE.DoubleSide,
    // All printed paper pieces are binary cutouts. Alpha blending makes the
    // renderer sort the paper laminations as transparent cards, which lets a
    // tan back lamina jump in front of the print at oblique angles. Alpha test
    // gives the same silhouette while keeping normal depth-buffer ordering.
    transparent: options.transparent ?? false,
    alphaTest: options.alphaTest ?? 0.025,
    alphaToCoverage: options.alphaToCoverage ?? true,
    depthWrite: true,
    polygonOffset: options.polygonOffset ?? false,
    polygonOffsetFactor: options.polygonOffsetFactor ?? 0,
    polygonOffsetUnits: options.polygonOffsetUnits ?? 0,
    emissive: options.emissive ?? 0x000000,
    emissiveMap: options.emissiveMap ? texture : null,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    toneMapped: options.toneMapped ?? true,
  });

  const replacementColor = options.paperColor ?? (clayMode ? 0xb7aa96 : null);
  if (replacementColor !== null) {
    const color = new THREE.Color(replacementColor);
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
          vec4 sampledDiffuseColor = texture2D(map, vMapUv);
          diffuseColor.a *= sampledDiffuseColor.a;
          diffuseColor.rgb = vec3(${color.r.toFixed(6)}, ${color.g.toFixed(6)}, ${color.b.toFixed(6)});
        `,
      );
    };
    material.customProgramCacheKey = () => `paper-mask-${color.getHexString()}`;
  }
  return material;
}

function printedMaterial(texture, options = {}) {
  return new THREE.MeshBasicMaterial({
    map: texture,
    color: options.color ?? 0xffffff,
    side: options.side ?? THREE.DoubleSide,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    alphaTest: options.alphaTest ?? 0.018,
    alphaToCoverage: options.alphaToCoverage ?? true,
    depthTest: true,
    depthWrite: true,
    polygonOffset: options.polygonOffset ?? false,
    polygonOffsetFactor: options.polygonOffsetFactor ?? 0,
    polygonOffsetUnits: options.polygonOffsetUnits ?? 0,
    // Printed fronts already contain authored light, shadow and grading.
    toneMapped: false,
  });
}

// Physical reverses are unprinted cardstock. Reusing a lit dark mask here
// turned every rotating facade into a near-black hole during the opening.
// This material keeps the source alpha silhouette but owns a stable neutral
// paper colour; source RGB never bleeds through and the endpoint front is
// unchanged.
function unlitPaperMaskMaterial(texture, color, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color,
    roughness: 0.98,
    metalness: 0,
    emissive: color,
    emissiveIntensity: 0.34,
    side: options.side ?? THREE.DoubleSide,
    transparent: false,
    alphaTest: options.alphaTest ?? 0.018,
    alphaToCoverage: options.alphaToCoverage ?? true,
    depthTest: true,
    depthWrite: true,
    toneMapped: false,
  });
  const paper = new THREE.Color(color);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.paperFiberMap = { value: paperFiberTexture };
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>\nuniform sampler2D paperFiberMap;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
        vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        diffuseColor.a *= sampledDiffuseColor.a;
        float fiber = texture2D(paperFiberMap, vMapUv * vec2(1.75, 2.4)).r;
        float paperVariation = mix(0.94, 1.06, smoothstep(0.455, 0.54, fiber));
        diffuseColor.rgb = vec3(${paper.r.toFixed(6)}, ${paper.g.toFixed(6)}, ${paper.b.toFixed(6)});
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `outgoingLight *= paperVariation;\n#include <opaque_fragment>`,
    );
  };
  material.customProgramCacheKey = () => `fiber-paper-mask-${paper.getHexString()}-v3`;
  return material;
}

function smooth01(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function sampleKeyframes(timeMs, frames, key) {
  if (timeMs <= frames[0].timeMs) return frames[0][key];
  const last = frames[frames.length - 1];
  if (timeMs >= last.timeMs) return last[key];
  for (let index = 0; index < frames.length - 1; index += 1) {
    const start = frames[index];
    const end = frames[index + 1];
    if (timeMs <= end.timeMs) {
      const local = smooth01((timeMs - start.timeMs) / (end.timeMs - start.timeMs));
      return THREE.MathUtils.lerp(start[key], end[key], local);
    }
  }
  return last[key];
}

const colorBundleManifest = await fetch(resolveAsset(`assets/${COLOR_BUNDLE_ROOT}/manifest.json`), { signal })
  .then((response) => response.json());
const colorBundlePaths = new Set(colorBundleManifest.outputs.map((item) => item.file));
const resolveBundleAsset = (path) => colorBundlePaths.has(path)
  ? `${COLOR_BUNDLE_ROOT}/${path}`
  : path;

const [
  assetMap,
  poses,
  depthPlan,
  standeeManifest,
  componentManifest,
  deckFootprintManifest,
  leftDeckContours,
  rightDeckContours,
] = await Promise.all([
  fetch(resolveAsset("assets/scene-map.json"), { signal }).then((response) => response.json()),
  fetch(resolveAsset("rig-poses.json"), { signal }).then((response) => response.json()),
  fetch(resolveAsset("assets/depth-plan.v0.4.json"), { signal }).then((response) => response.json()),
  fetch(resolveAsset("assets/city/standees/manifest.json"), { signal }).then((response) => response.json()),
  fetch(resolveAsset("assets/components/manifest.json"), { signal }).then((response) => response.json()),
  fetch(resolveAsset("assets/deck-footprints-manifest.json"), { signal }).then((response) => response.json()),
  fetch(resolveAsset(`assets/${resolveBundleAsset("deck-footprints/near-left-deck-contours.json")}`), { signal }).then((response) => response.json()),
  fetch(resolveAsset(`assets/${resolveBundleAsset("deck-footprints/near-right-deck-contours.json")}`), { signal }).then((response) => response.json()),
]);

const deckContourById = new Map([
  [leftDeckContours.id, leftDeckContours],
  [rightDeckContours.id, rightDeckContours],
]);
const deckFootprintByMechanism = new Map(
  deckFootprintManifest.decks.map((deck) => [deck.replacesSupportGeometryFor, deck]),
);

const texturePaths = [
  "book/surface-left.png",
  "book/surface-right.png",
  "book/page-left.png",
  "book/page-right.png",
  "physical-partition/top-skin-left.png",
  "physical-partition/top-skin-right.png",
  "physical-partition/cant-horizontal-left.png",
  "physical-partition/cant-vertical-left.png",
  "physical-partition/cant-horizontal-right.png",
  "physical-partition/cant-vertical-right.png",
  "book/edge-material-horizontal.png",
  "book/edge-material-vertical.png",
  "cover.png",
  "materials/cardstock-back-fiber.png",
  "physical-v05/front-left/front-left-microdeck-top.png",
  "physical-v05/front-left/front-left-page-ground-print.png",
  "physical-v05/front-left/front-left-page-ground-residual.png",
  "physical-v05/front-left/front-left-retiro-train-fascia.png",
  "physical-v05/front-left/front-left-stair-wing.png",
  "physical-v05/rear-left/rear-left-inner.png",
  "physical-v05/rear-left/rear-left-outer.png",
  "physical-v05/rear-right/rear-right-inner.png",
  "physical-v05/rear-right/rear-right-outer.png",
  "physical-v05/obelisk/obelisk-base-page-print.png",
  "physical-v05/obelisk/obelisk-front-left-trim.png",
  "physical-v05/obelisk/obelisk-front-right-trim.png",
  "physical-v05/obelisk/obelisk-front-left-2px-bleed.png",
  "physical-v05/obelisk/obelisk-front-right-2px-bleed.png",
  "physical-v05/obelisk/obelisk-return-left-strip.png",
  "physical-v05/obelisk/obelisk-return-right-strip.png",
  assetMap.taxi.file,
  ...assetMap.city.map((item) => item.file),
  ...standeeManifest.pieces.map((item) => item.file),
  ...componentManifest.assets.map((item) => `components/${item.file}`),
  ...deckFootprintManifest.decks.map((item) => item.surfaceFile.replace(/^assets\//, "")),
];
const textureEntries = await Promise.all(
  texturePaths.map(async (path) => {
    const resolved = resolveBundleAsset(path);
    return [path, await loadTexture(`assets/${resolved}`)];
  }),
);
const textures = new Map(textureEntries);
const paperFiberTexture = textures.get("materials/cardstock-back-fiber.png");
// Fiber is scalar material data, not display colour. Sampling it through the
// sRGB decode collapsed its authored 116..137 range below the shader's
// threshold and made every reverse perfectly flat.
paperFiberTexture.colorSpace = THREE.NoColorSpace;
paperFiberTexture.needsUpdate = true;
paperFiberTexture.wrapS = THREE.RepeatWrapping;
paperFiberTexture.wrapT = THREE.RepeatWrapping;

function buildGutterPrintTexture() {
  const leftImage = textures.get("book/page-left.png").image;
  const rightImage = textures.get("book/page-right.png").image;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = leftImage.naturalHeight || leftImage.height;
  const context = canvas.getContext("2d");
  const leftWidthPx = leftImage.naturalWidth || leftImage.width;
  // Preserve the authored alpha at the inner page contours. Filling this
  // narrow bridge with an opaque neutral created a black/grey rectangular
  // plug at the fore edge. The physical leather spine below is the correct
  // owner wherever neither printed page strip has ink; the red/gold curls in
  // the two atlas edges remain on this cap.
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(leftImage, leftWidthPx - 16, 0, 16, canvas.height, 0, 0, 16, canvas.height);
  context.drawImage(rightImage, 0, 0, 16, canvas.height, 16, 0, 16, canvas.height);
  // The last atlas rows are nearly black premultiplied edge pixels. Replace
  // only that narrow fore-edge pocket with a real leather crop from the cover
  // stock: the cap remains attached to the physical gutter, while the two
  // independently modelled gold page curls retain their authored ownership.
  const coverImage = textures.get("cover.png").image;
  context.drawImage(
    coverImage,
    384,
    1420,
    256,
    116,
    0,
    canvas.height - 62,
    canvas.width,
    62,
  );
  context.globalCompositeOperation = "screen";
  context.fillStyle = "rgba(112, 70, 36, 0.24)";
  context.fillRect(0, canvas.height - 62, canvas.width, 62);
  context.globalCompositeOperation = "source-over";
  return configureTexture(new THREE.CanvasTexture(canvas));
}

const gutterPrintTexture = buildGutterPrintTexture();

function cropTexture(sourceTexture, { x, y, width, height }, name) {
  const source = sourceTexture.image;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(source, x, y, width, height, 0, 0, width, height);
  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  texture.name = name;
  return texture;
}

function knockoutTexture(sourceTexture, { x, y, width, height }, name) {
  const source = sourceTexture.image;
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext("2d");
  context.drawImage(source, 0, 0);
  // Remove only authored opaque pixels, not the crop rectangle. Transparent
  // alleys and page gaps therefore remain continuous around the lifted card.
  context.globalCompositeOperation = "destination-out";
  context.drawImage(source, x, y, width, height, x, y, width, height);
  context.globalCompositeOperation = "source-over";
  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  texture.name = name;
  return texture;
}

const bookRoot = new THREE.Group();
bookRoot.position.set(0, 0, 8);
// Mechanics contract: never anisotropically scale the book root.  The fixed
// hero lens above controls framing without changing cover/textblock matrices,
// hinge distances, or the cross-slot's physical proportions.
bookRoot.scale.set(1, 1, 1);
scene.add(bookRoot);

const warmAmbient = new THREE.HemisphereLight(
  clayMode ? 0xe2d7c8 : 0xd4d1c9,
  clayMode ? 0x3b342f : 0x242321,
  clayMode ? 1.35 : 0.34,
);
scene.add(warmAmbient);

const keyLight = new THREE.DirectionalLight(clayMode ? 0xfff3dd : 0xf1ede5, clayMode ? 3.0 : 1.35);
keyLight.position.set(-780, 1250, 920);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(4096, 4096);
keyLight.shadow.camera.left = -1250;
keyLight.shadow.camera.right = 1250;
keyLight.shadow.camera.top = 1150;
keyLight.shadow.camera.bottom = -850;
keyLight.shadow.camera.near = 50;
keyLight.shadow.camera.far = 4000;
keyLight.shadow.bias = -0.0002;
keyLight.shadow.normalBias = 0.8;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(clayMode ? 0xcbd4dc : 0xa6afb5, clayMode ? 0.9 : 0.24);
rimLight.position.set(820, 620, -980);
scene.add(rimLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(3000, 2200),
  viewMode === "side" || clayMode
    ? solidMaterial(clayMode ? 0x494039 : 0x2a1810, { roughness: 1 })
    : new THREE.ShadowMaterial({ color: 0x171310, opacity: 0.22 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2;
floor.receiveShadow = true;
scene.add(floor);

const pagePaper = solidMaterial(clayMode ? 0xc7bba7 : 0x766348, { roughness: 0.98 });
const horizontalEdgeTexture = textures.get("book/edge-material-horizontal.png");
const verticalEdgeTexture = textures.get("book/edge-material-vertical.png");
horizontalEdgeTexture.wrapS = THREE.RepeatWrapping;
horizontalEdgeTexture.wrapT = THREE.ClampToEdgeWrapping;
verticalEdgeTexture.wrapS = THREE.ClampToEdgeWrapping;
verticalEdgeTexture.wrapT = THREE.RepeatWrapping;
horizontalEdgeTexture.needsUpdate = true;
verticalEdgeTexture.needsUpdate = true;
const pageEdge = clayMode
  ? solidMaterial(0x8b7862, { roughness: 0.95, side: THREE.DoubleSide })
  : printedMaterial(horizontalEdgeTexture, { alphaTest: 0, side: THREE.DoubleSide });
const pageEdgeVertical = clayMode
  ? solidMaterial(0x8b7862, { roughness: 0.95, side: THREE.DoubleSide })
  : printedMaterial(verticalEdgeTexture, { alphaTest: 0, side: THREE.DoubleSide });

function closedPageBlockTexture() {
  const source = horizontalEdgeTexture.image;
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  // The authored swatch contains a five-pixel highlight belonging to the top
  // sheet.  A closed text block already has a separate cover/page lip, so
  // repeating that highlight creates the false white rail seen in the first
  // volume pass.  Sample only the true laminated fore-edge below it.
  const cropTop = Math.min(10, sourceHeight - 1);
  context.drawImage(
    source,
    0,
    cropTop,
    sourceWidth,
    sourceHeight - cropTop,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  texture.name = "closed-page-block-layers";
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

const closedPageEdgeMaterial = clayMode
  ? pageEdge
  : printedMaterial(closedPageBlockTexture(), { alphaTest: 0, side: THREE.DoubleSide });
const leather = solidMaterial(clayMode ? 0x51443b : 0x25110d, { roughness: 0.82 });
// The exposed spine head is a separate burgundy binding leather.  Reusing the
// near-black cover-board material turned the narrow fore-edge reveal into a
// rectangular void; the authored spread shows a warmer red/brown headband
// between the two gold page curls.
const bindingLeather = solidMaterial(clayMode ? 0x51443b : 0x5f211d, { roughness: 0.88 });
function deterministicLeatherGrainTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const image = context.createImageData(size, size);
  const hash = (x, y) => {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return value - Math.floor(value);
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const broad = hash(Math.floor(x / 4), Math.floor(y / 7));
      const fine = hash(x, y);
      const grain = Math.round(108 + broad * 46 + fine * 24);
      const index = (y * size + x) * 4;
      image.data[index] = grain;
      image.data[index + 1] = grain;
      image.data[index + 2] = grain;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 2.5);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const exteriorSpineLeather = new THREE.MeshStandardMaterial({
  color: clayMode ? 0x51443b : 0x4d1d18,
  roughness: clayMode ? 0.94 : 0.72,
  metalness: 0,
  bumpMap: deterministicLeatherGrainTexture(),
  bumpScale: clayMode ? 0 : 0.85,
  side: THREE.DoubleSide,
});
const raisedSpineLeather = solidMaterial(clayMode ? 0x5a4c42 : 0x5a211b, { roughness: 0.74 });
const spineJointLeather = solidMaterial(clayMode ? 0x473b34 : 0x2a0d0c, { roughness: 0.86 });
const headbandGold = solidMaterial(clayMode ? 0x8b7862 : 0xa06f32, { roughness: 0.76 });
const hingePaper = solidMaterial(clayMode ? 0xc3b5a0 : 0x746551, { roughness: 0.98 });
const cityBackPaper = clayMode ? 0xb2a48f : 0x5a5147;
const gutterBridgePaper = clayMode
  ? solidMaterial(0xbcae99, { roughness: 0.98 })
  : new THREE.MeshBasicMaterial({ color: 0x5a5047, side: THREE.DoubleSide, toneMapped: false });
const hiddenPageBodySkin = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false,
});

function pageShape(meta, width, depth, mirrorX = false) {
  const shape = new THREE.Shape();
  const depthScale = depth / meta.globalBbox.height;
  meta.pageContourLocal.points.forEach(([sourceX, sourceY], index) => {
    const x = mirrorX ? width - sourceX : sourceX;
    const y = depth / 2 - sourceY * depthScale;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function pageBody(meta, width, depth, thickness, mirrorX = false) {
  let geometry = new THREE.ExtrudeGeometry(pageShape(meta, width, depth, mirrorX), {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  if (geometry.index) geometry = geometry.toNonIndexed();
  geometry.clearGroups();
  const positions = geometry.getAttribute("position");
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox.min.y;
  const maxY = geometry.boundingBox.max.y;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let index = 0; index < positions.count; index += 3) {
    a.fromBufferAttribute(positions, index);
    b.fromBufferAttribute(positions, index + 1);
    c.fromBufferAttribute(positions, index + 2);
    normal.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    const faceY = (a.y + b.y + c.y) / 3;
    const authoredTop = mirrorX
      ? faceY <= minY + 0.01
      : faceY >= maxY - 0.01;
    // The physical partition owns every hero-visible top/cant pixel.  The
    // opposite generic cap is useful only as an underside construction proof
    // in clay/side review.  Letting it render in hero made its horizontal plane
    // sit in front of the deprojected cant ribbon and created the two large
    // dark wedges below Retiro and Riachuelo.
    const structuralUnderside = Math.abs(normal.y) > 0.72 && !authoredTop;
    const materialIndex = structuralUnderside && (clayMode || viewMode === "side") ? 0 : 3;
    geometry.addGroup(index, 3, materialIndex);
  }
  const mesh = new THREE.Mesh(
    geometry,
    [pagePaper, pageEdge, pageEdgeVertical, hiddenPageBodySkin],
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function closedPageEdgeSkin(body, name) {
  const geometry = body.geometry.clone();
  geometry.clearGroups();
  const positions = geometry.getAttribute("position");
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const uvs = new Float32Array(positions.count * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let index = 0; index < positions.count; index += 3) {
    a.fromBufferAttribute(positions, index);
    b.fromBufferAttribute(positions, index + 1);
    c.fromBufferAttribute(positions, index + 2);
    normal.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    const isEdge = Math.abs(normal.y) <= 0.72;
    const useX = Math.abs(normal.z) >= Math.abs(normal.x);
    for (const [offset, point] of [[0, a], [1, b], [2, c]]) {
      const along = useX
        ? (point.x - bounds.min.x) / Math.max(0.0001, bounds.max.x - bounds.min.x)
        : (point.z - bounds.min.z) / Math.max(0.0001, bounds.max.z - bounds.min.z);
      const through = (point.y - bounds.min.y) / Math.max(0.0001, bounds.max.y - bounds.min.y);
      uvs[(index + offset) * 2] = along;
      uvs[(index + offset) * 2 + 1] = through;
    }
    const materialIndex = isEdge ? 0 : 1;
    geometry.addGroup(index, 3, materialIndex);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  const mesh = new THREE.Mesh(
    geometry,
    [closedPageEdgeMaterial, hiddenPageBodySkin],
  );
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.closedPageEdgeSkin = true;
  return mesh;
}

function contourWithoutDuplicate(points) {
  const clean = points.map(([x, y]) => new THREE.Vector2(x, y));
  if (clean.length > 1 && clean[0].distanceTo(clean[clean.length - 1]) < 0.001) clean.pop();
  return clean;
}

function closedContourSampler(points) {
  const contour = contourWithoutDuplicate(points);
  const cumulative = [0];
  for (let index = 0; index < contour.length; index += 1) {
    cumulative.push(
      cumulative[index] + contour[index].distanceTo(contour[(index + 1) % contour.length]),
    );
  }
  const total = cumulative[cumulative.length - 1];
  return {
    total,
    at(unit) {
      const distance = THREE.MathUtils.euclideanModulo(unit, 1) * total;
      let segment = 0;
      while (segment < contour.length - 1 && cumulative[segment + 1] < distance) segment += 1;
      const start = contour[segment];
      const end = contour[(segment + 1) % contour.length];
      const span = Math.max(0.0001, cumulative[segment + 1] - cumulative[segment]);
      return start.clone().lerp(end, (distance - cumulative[segment]) / span);
    },
  };
}

function openContourSampler(points, startIndex, endIndex) {
  const path = points
    .slice(startIndex, endIndex + 1)
    .map(([x, y]) => new THREE.Vector2(x, y));
  const cumulative = [0];
  for (let index = 1; index < path.length; index += 1) {
    cumulative.push(cumulative[index - 1] + path[index - 1].distanceTo(path[index]));
  }
  const total = Math.max(0.0001, cumulative[cumulative.length - 1]);
  return {
    total,
    vertexUnits: cumulative.map((distance) => distance / total),
    at(unit) {
      const distance = THREE.MathUtils.clamp(unit, 0, 1) * total;
      let segment = 0;
      while (segment < path.length - 2 && cumulative[segment + 1] < distance) segment += 1;
      const span = Math.max(0.0001, cumulative[segment + 1] - cumulative[segment]);
      return path[segment].clone().lerp(
        path[segment + 1],
        (distance - cumulative[segment]) / span,
      );
    },
  };
}

const CANT_OPEN_SECTIONS = {
  left: [
    { page: [0, 11], surface: [0, 25] },
  ],
  right: [
    { page: [4, 5], surface: [5, 6] },
    { page: [12, 23], surface: [8, 28] },
  ],
};

function textureAlphaPixels(texture) {
  const image = texture.image;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  return { width, height, data: context.getImageData(0, 0, width, height).data };
}

// The semantic surface contour overlaps the extracted book edge by as much as
// 50 px on the right fore edge.  The strict physical partition resolves those
// pixels to the cant, so using the older semantic contour as the inner ribbon
// seam left a desk-visible wedge.  Derive the long front seam from the actual
// alpha-disjoint owners: the last top-skin pixel and the last canonical page
// pixel in each column.  Short outer/hinge turns still use the authored open
// contour sections above.
function partitionFrontCantRuns(side, topTexture) {
  const top = textureAlphaPixels(topTexture);
  const page = textureAlphaPixels(textures.get(`book/page-${side}.png`));
  const horizontal = textureAlphaPixels(
    textures.get(`physical-partition/cant-horizontal-${side}.png`),
  );
  const rows = [];
  const minimumY = Math.floor(top.height * 0.52);
  for (let x = 0; x < top.width; x += 1) {
    let innerY = -1;
    let outerY = -1;
    let ownsFrontCant = false;
    for (let y = minimumY; y < top.height; y += 1) {
      const alphaOffset = (y * top.width + x) * 4 + 3;
      if (top.data[alphaOffset] > 8) innerY = y;
      if (page.data[alphaOffset] > 8) outerY = y;
      if (horizontal.data[alphaOffset] > 8) ownsFrontCant = true;
    }
    if (innerY >= 0 && outerY > innerY && ownsFrontCant) rows.push({ x, innerY, outerY });
  }

  const runs = [];
  let run = [];
  for (const row of rows) {
    if (run.length && row.x !== run[run.length - 1].x + 1) {
      if (run.length > 1) runs.push(run);
      run = [];
    }
    run.push(row);
  }
  if (run.length > 1) runs.push(run);

  // Four source pixels per column pair keep the perspective interpolation
  // under one endpoint pixel while avoiding a 900-column mesh.
  return runs.map((columns) => {
    const sampled = columns.filter((_, index) => index % 4 === 0);
    const last = columns[columns.length - 1];
    if (sampled[sampled.length - 1] !== last) sampled.push(last);
    return sampled;
  });
}

function endpointPagePoint(screenX, screenY, side, localY) {
  const pageMatrix = endpointPageMatrix(side);
  heroCamera.updateMatrixWorld(true);
  const inversePage = pageMatrix.clone().invert();
  const planePoint = new THREE.Vector3(0, localY, 0).applyMatrix4(pageMatrix);
  const planeNormal = new THREE.Vector3(0, 1, 0)
    .applyMatrix3(new THREE.Matrix3().getNormalMatrix(pageMatrix))
    .normalize();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, planePoint);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(
    new THREE.Vector2(screenX / WIDTH * 2 - 1, 1 - screenY / HEIGHT * 2),
    heroCamera,
  );
  const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  if (!point) throw new Error(`Cannot deproject page contour point ${screenX},${screenY}`);
  return point.applyMatrix4(inversePage);
}

function combinedCantFrontTexture(side) {
  const horizontal = textures.get(`physical-partition/cant-horizontal-${side}.png`).image;
  const vertical = textures.get(`physical-partition/cant-vertical-${side}.png`).image;
  const canvas = document.createElement("canvas");
  canvas.width = horizontal.naturalWidth || horizontal.width;
  canvas.height = horizontal.naturalHeight || horizontal.height;
  const context = canvas.getContext("2d");
  context.drawImage(horizontal, 0, 0);
  context.drawImage(vertical, 0, 0);
  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  texture.name = `physical-cant-combined-${side}`;
  return texture;
}

function physicalPageSkin(texture, meta, side, topLocalY, outerLocalY) {
  const surface = contourWithoutDuplicate(meta.surfaceContourLocal.points);
  const originX = meta.globalBbox.x;
  const originY = meta.globalBbox.y;
  const pageWidth = meta.globalBbox.width;
  const pageHeight = meta.globalBbox.height;
  const positions = [];
  const uvs = [];
  const backUvs = [];
  const indices = [];
  const groups = [];

  // Triangulate only the semantic top contour. The alpha-disjoint top-skin
  // texture owns these pixels; full page-left/right remains reference-only.
  const topContour = surface.map((point) => new THREE.Vector2(point.x, -point.y));
  const topTriangles = THREE.ShapeUtils.triangulateShape(topContour, []);
  for (const point of surface) {
    const local = endpointPagePoint(originX + point.x, originY + point.y, side, topLocalY);
    positions.push(local.x, local.y, local.z);
    uvs.push(point.x / pageWidth, 1 - point.y / pageHeight);
    backUvs.push(0, 0);
  }
  for (const [a, b, c] of topTriangles) indices.push(a, b, c);
  groups.push({ start: 0, count: indices.length, materialIndex: 0 });

  // The contours share a few authored landmarks but not a uniform loop
  // parameterization. Pairing the complete loops by one t makes the gutter
  // consume a different fraction on each path and twists the cant. Instead,
  // resample contiguous, landmark-anchored open paths; preserve every source
  // corner plus a ~12 px sampling floor.
  const repeatLengthWorld = Math.abs(topLocalY - outerLocalY) * (256 / 24);
  let physicalArcWorld = 0;
  for (const section of CANT_OPEN_SECTIONS[side]) {
    const innerPath = openContourSampler(
      meta.surfaceContourLocal.points,
      section.surface[0],
      section.surface[1],
    );
    const outerPath = openContourSampler(
      meta.pageContourLocal.points,
      section.page[0],
      section.page[1],
    );
    const units = new Set([0, 1, ...innerPath.vertexUnits, ...outerPath.vertexUnits]);
    const uniformCount = Math.ceil(Math.max(innerPath.total, outerPath.total) / 12);
    for (let sample = 1; sample < uniformCount; sample += 1) units.add(sample / uniformCount);
    const orderedUnits = [...units].sort((a, b) => a - b);
    const samples = orderedUnits.map((unit) => {
      const innerSource = innerPath.at(unit);
      const outerSource = outerPath.at(unit);
      return {
        unit,
        innerSource,
        outerSource,
        inner: endpointPagePoint(
          originX + innerSource.x,
          originY + innerSource.y,
          side,
          topLocalY,
        ),
        outer: endpointPagePoint(
          originX + outerSource.x,
          originY + outerSource.y,
          side,
          outerLocalY,
        ),
      };
    });
    samples[0].arcWorld = physicalArcWorld;
    for (let index = 1; index < samples.length; index += 1) {
      samples[index].arcWorld = samples[index - 1].arcWorld
        + samples[index - 1].outer.distanceTo(samples[index].outer);
    }

    // Consecutive intervals with the same swatch orientation share vertices;
    // only H/V transitions duplicate an exactly coincident row for UV axes.
    let interval = 0;
    while (interval < samples.length - 1) {
      const firstTangent = samples[interval + 1].outerSource
        .clone()
        .sub(samples[interval].outerSource);
      const horizontal = Math.abs(firstTangent.x) >= Math.abs(firstTangent.y);
      let runEnd = interval + 1;
      while (runEnd < samples.length - 1) {
        const tangent = samples[runEnd + 1].outerSource
          .clone()
          .sub(samples[runEnd].outerSource);
        const nextHorizontal = Math.abs(tangent.x) >= Math.abs(tangent.y);
        if (nextHorizontal !== horizontal) break;
        runEnd += 1;
      }
      const runVertexStart = positions.length / 3;
      for (let sampleIndex = interval; sampleIndex <= runEnd; sampleIndex += 1) {
        const sample = samples[sampleIndex];
        positions.push(
          sample.inner.x,
          sample.inner.y,
          sample.inner.z,
          sample.outer.x,
          sample.outer.y,
          sample.outer.z,
        );
        const phase = sample.arcWorld / repeatLengthWorld;
        // Front-facing UV follows the canonical page-local partition exactly.
        // The physical-arclength swatch lives in uv2 and is sampled only on
        // the reverse/off-axis face by the cant shader.
        uvs.push(
          sample.innerSource.x / pageWidth,
          1 - sample.innerSource.y / pageHeight,
          sample.outerSource.x / pageWidth,
          1 - sample.outerSource.y / pageHeight,
        );
        if (horizontal) backUvs.push(phase, 1, phase, 0);
        else backUvs.push(0, phase, 1, phase);
      }
      const start = indices.length;
      for (let sampleIndex = interval; sampleIndex < runEnd; sampleIndex += 1) {
        const offset = sampleIndex - interval;
        const innerA = runVertexStart + offset * 2;
        const outerA = innerA + 1;
        const innerB = innerA + 2;
        const outerB = innerA + 3;
        indices.push(innerA, outerA, innerB, outerA, outerB, innerB);
      }
      groups.push({
        start,
        count: indices.length - start,
        materialIndex: horizontal ? 1 : 2,
      });
      interval = runEnd;
    }
    physicalArcWorld = samples[samples.length - 1].arcWorld;
  }

  // Exact alpha-owner front ribbon.  It is still a noncoplanar physical skin:
  // every inner sample lies on the moving top sheet and every outer sample on
  // the page-body plane.  Only its endpoint parameterization comes from the
  // strict top/cant partition rather than the overlapping semantic mask.
  for (const run of partitionFrontCantRuns(side, texture)) {
    const runVertexStart = positions.length / 3;
    let runArcWorld = physicalArcWorld;
    let previousOuter = null;
    for (const sample of run) {
      const innerSource = new THREE.Vector2(sample.x, sample.innerY);
      const outerSource = new THREE.Vector2(sample.x, sample.outerY);
      const inner = endpointPagePoint(
        originX + innerSource.x,
        originY + innerSource.y,
        side,
        topLocalY,
      );
      const outer = endpointPagePoint(
        originX + outerSource.x,
        originY + outerSource.y,
        side,
        outerLocalY,
      );
      if (previousOuter) runArcWorld += previousOuter.distanceTo(outer);
      previousOuter = outer;
      const phase = runArcWorld / repeatLengthWorld;
      positions.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
      uvs.push(
        innerSource.x / pageWidth,
        1 - innerSource.y / pageHeight,
        outerSource.x / pageWidth,
        1 - outerSource.y / pageHeight,
      );
      backUvs.push(phase, 1, phase, 0);
    }
    const start = indices.length;
    for (let index = 0; index < run.length - 1; index += 1) {
      const innerA = runVertexStart + index * 2;
      const outerA = innerA + 1;
      const innerB = innerA + 2;
      const outerB = innerA + 3;
      indices.push(innerA, outerA, innerB, outerA, outerB, innerB);
    }
    groups.push({ start, count: indices.length - start, materialIndex: 1 });
    physicalArcWorld = runArcWorld;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("uv2", new THREE.Float32BufferAttribute(backUvs, 2));
  geometry.setIndex(indices);
  geometry.clearGroups();
  groups.forEach((group) => geometry.addGroup(group.start, group.count, group.materialIndex));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const topMaterial = clayMode
    ? texturedMaterial(texture, {
      alphaTest: 0.01,
      paperColor: 0xc7bba7,
      roughness: 0.96,
    })
    : printedMaterial(texture, { alphaTest: 0.01 });
  const cantMaterial = (frontTexture, backTexture) => {
    if (clayMode) return solidMaterial(0x8b7862, {
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    return new THREE.ShaderMaterial({
      uniforms: {
        frontMap: { value: frontTexture },
        backMap: { value: backTexture },
      },
      vertexShader: `
        attribute vec2 uv2;
        varying vec2 vFrontUv;
        varying vec2 vBackUv;
        void main() {
          vFrontUv = uv;
          vBackUv = uv2;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D frontMap;
        uniform sampler2D backMap;
        varying vec2 vFrontUv;
        varying vec2 vBackUv;
        void main() {
          vec4 paper = gl_FrontFacing
            ? texture2D(frontMap, vFrontUv)
            : texture2D(backMap, vBackUv);
          if (gl_FrontFacing && paper.a < 0.01) discard;
          gl_FragColor = paper;
          #include <colorspace_fragment>
        }
      `,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: true,
      toneMapped: false,
    });
  };
  // H/V source masks are alpha-disjoint, but a geometric tangent can change
  // a fraction of a pixel away from the authored classifier. Composite the
  // two canonical owners once and sample that same front map on both groups;
  // the groups still select the correct physical swatch on the reverse face.
  const combinedFront = combinedCantFrontTexture(side);
  const mesh = new THREE.Mesh(geometry, [
    topMaterial,
    cantMaterial(combinedFront, horizontalEdgeTexture),
    cantMaterial(combinedFront, verticalEdgeTexture),
  ]);
  mesh.name = `physical-page-skin-${side}`;
  mesh.userData.physicalPagePartition = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function pageSurface(texture, meta, width, depth, mirrorX = false, registration = null) {
  let geometry;
  if (registration && hybridSpike) {
    // The page-area/street mask already contains photographed perspective.
    // Deproject only that top print onto the moving sheet; the physical page
    // body below owns its cant and returns, so no baked edge becomes a flat
    // screen-facing plate.
    geometry = pageQuadGeometryForScreenBbox(
      registration.bbox,
      registration.side,
      registration.localY,
      12,
    );
  } else {
    geometry = new THREE.ShapeGeometry(pageShape(meta, width, depth, mirrorX));
    const positions = geometry.getAttribute("position");
    const uv = new Float32Array(positions.count * 2);
    const depthScale = depth / meta.globalBbox.height;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const sourceX = mirrorX ? width - x : x;
      const sourceY = (depth / 2 - y) / depthScale;
      uv[index * 2] = THREE.MathUtils.clamp(sourceX / width, 0, 1);
      uv[index * 2 + 1] = THREE.MathUtils.clamp(1 - sourceY / meta.globalBbox.height, 0, 1);
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geometry.rotateX(-Math.PI / 2);
  }
  const mesh = new THREE.Mesh(
    geometry,
    texture
      ? (clayMode ? texturedMaterial(texture, {
        alphaTest: 0.01,
        paperColor: 0xc7bba7,
        roughness: 0.96,
      }) : printedMaterial(texture, { alphaTest: 0.01 }))
      : pagePaper,
  );
  mesh.receiveShadow = true;
  return mesh;
}

const leftMeta = assetMap.book.pages.left;
const rightMeta = assetMap.book.pages.right;
const leftWidth = leftMeta.globalBbox.width;
const rightWidth = rightMeta.globalBbox.width;
const pageDepth = PAGE_DEPTH_WORLD;
const sourceToDepth = pageDepth / assetMap.book.globalBbox.height;
const sourceBookCenterY = assetMap.book.globalBbox.y + assetMap.book.globalBbox.height / 2;
const spreadWorld = leftWidth + rightWidth;
const xWorldPerMm = spreadWorld / depthPlan.coordinateSystem.spread.width;
const yWorldPerMm = 5;
const zWorldPerMm = pageDepth / depthPlan.coordinateSystem.spread.depth;

function xMmToWorld(value) {
  return value * xWorldPerMm;
}

function zMmToWorld(value) {
  return pageDepth / 2 - value * zWorldPerMm;
}

function attachToFacingPage(object, worldX, elevationWorld = 0) {
  if (worldX < 0) {
    object.rotation.z = Math.PI;
    object.position.set(-worldX, -(0.85 + elevationWorld), object.position.z);
    leftTextblock.add(object);
    return "left";
  }
  object.position.set(worldX, PAGE_THICKNESS + 0.85 + elevationWorld, object.position.z);
  rightTextblock.add(object);
  return "right";
}

const rightTextblock = new THREE.Group();
bookRoot.add(rightTextblock);
const rightBody = pageBody(rightMeta, rightWidth, pageDepth, PAGE_THICKNESS, false);
rightTextblock.add(rightBody);
const rightClosedEdgeSkin = closedPageEdgeSkin(rightBody, "closed-page-edge-right");
rightTextblock.add(rightClosedEdgeSkin);
const rightTop = physicalPageSkin(
  textures.get("physical-partition/top-skin-right.png"),
  rightMeta,
  "right",
  PAGE_THICKNESS + 0.7,
  0,
);
rightTextblock.add(rightTop);

const leftTextblock = new THREE.Group();
leftTextblock.position.y = PAGE_THICKNESS;
bookRoot.add(leftTextblock);
const leftBody = pageBody(leftMeta, leftWidth, pageDepth, PAGE_THICKNESS, true);
leftTextblock.add(leftBody);
const leftClosedEdgeSkin = closedPageEdgeSkin(leftBody, "closed-page-edge-left");
leftTextblock.add(leftClosedEdgeSkin);
const leftClosedTop = pageSurface(null, leftMeta, leftWidth, pageDepth, true);
leftClosedTop.name = "physical-left-closed-top";
leftClosedTop.position.y = PAGE_THICKNESS + 0.7;
leftTextblock.add(leftClosedTop);
const leftFinalPage = physicalPageSkin(
  textures.get("physical-partition/top-skin-left.png"),
  leftMeta,
  "left",
  -0.7,
  PAGE_THICKNESS,
);
leftTextblock.add(leftFinalPage);

// Registered page prints are the low-relief layer of the decoupage. They use
// the source composite coordinates verbatim, so missing atmosphere can be
// restored without turning every skyline row into one flat billboard. A small
// number of physical cutouts may sit above these prints later.
const pageDecals = [];
function endpointPageMatrix(side) {
  bookRoot.updateMatrixWorld(true);
  const endpointAngle = THREE.MathUtils.degToRad(side === "left" ? 177.5 : 2.5);
  const pagePosition = side === "left"
    ? new THREE.Vector3(0, PAGE_THICKNESS, 0)
    : new THREE.Vector3();
  const pageQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, endpointAngle));
  const localMatrix = new THREE.Matrix4().compose(
    pagePosition,
    pageQuaternion,
    new THREE.Vector3(1, 1, 1),
  );
  return bookRoot.matrixWorld.clone().multiply(localMatrix);
}

function pageQuadGeometryForScreenBbox(bbox, side, localY, subdivisions = 8) {
  const [x, y, width, height] = bbox;
  const pageMatrix = endpointPageMatrix(side);
  const inversePage = pageMatrix.clone().invert();
  const planePoint = new THREE.Vector3(0, localY, 0).applyMatrix4(pageMatrix);
  const planeNormal = new THREE.Vector3(0, 1, 0)
    .applyMatrix3(new THREE.Matrix3().getNormalMatrix(pageMatrix))
    .normalize();
  const pagePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, planePoint);
  heroCamera.updateMatrixWorld(true);

  const positions = [];
  const uvs = [];
  for (let row = 0; row <= subdivisions; row += 1) {
    for (let column = 0; column <= subdivisions; column += 1) {
      const u = column / subdivisions;
      const vTop = row / subdivisions;
      const screenX = x + width * u;
      const screenY = y + height * vTop;
    const ndc = new THREE.Vector2(
      screenX / WIDTH * 2 - 1,
      1 - screenY / HEIGHT * 2,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, heroCamera);
    const point = raycaster.ray.intersectPlane(pagePlane, new THREE.Vector3());
    if (!point) throw new Error(`Cannot deproject ${bbox.join(",")} onto ${side} page`);
      positions.push(...point.applyMatrix4(inversePage).toArray());
      uvs.push(u, 1 - vTop);
    }
  }

  const indices = [];
  const stride = subdivisions + 1;
  for (let row = 0; row < subdivisions; row += 1) {
    for (let column = 0; column < subdivisions; column += 1) {
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, c, d, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(uvs, 2),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

const physicalDeprojectionQueue = [];

function screenRegisteredGeometryOnMesh(
  mesh,
  bbox,
  subdivisions = 8,
  localNormal = new THREE.Vector3(0, 0, 1),
) {
  const [x, y, width, height] = bbox;
  mesh.updateWorldMatrix(true, false);
  heroCamera.updateMatrixWorld(true);
  const meshMatrix = mesh.matrixWorld.clone();
  const inverseMesh = meshMatrix.clone().invert();
  const planePoint = new THREE.Vector3(0, 0, 0).applyMatrix4(meshMatrix);
  const planeNormal = localNormal.clone()
    .applyMatrix3(new THREE.Matrix3().getNormalMatrix(meshMatrix))
    .normalize();
  const physicalPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, planePoint);
  const positions = [];
  const uvs = [];
  for (let row = 0; row <= subdivisions; row += 1) {
    for (let column = 0; column <= subdivisions; column += 1) {
      const u = column / subdivisions;
      const vTop = row / subdivisions;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(
        new THREE.Vector2(
          (x + width * u) / WIDTH * 2 - 1,
          1 - (y + height * vTop) / HEIGHT * 2,
        ),
        heroCamera,
      );
      const point = raycaster.ray.intersectPlane(physicalPlane, new THREE.Vector3());
      if (!point) throw new Error(`Cannot deproject ${bbox.join(",")} onto ${mesh.name || "paper plane"}`);
      positions.push(...point.applyMatrix4(inverseMesh).toArray());
      uvs.push(u, 1 - vTop);
    }
  }
  const indices = [];
  const stride = subdivisions + 1;
  for (let row = 0; row < subdivisions; row += 1) {
    for (let column = 0; column < subdivisions; column += 1) {
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, c, d, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function queuePhysicalDeprojection(
  entry,
  meshes,
  bbox,
  id,
  subdivisions = 8,
  localNormal = new THREE.Vector3(0, 0, 1),
  options = {},
) {
  physicalDeprojectionQueue.push({
    entry,
    meshes,
    bbox,
    id,
    subdivisions,
    localNormal,
    hingeBbox: options.hingeBbox,
    hingeZInsetMm: options.hingeZInsetMm ?? 0,
    beforeGeometry: options.beforeGeometry,
  });
}

function clipTextureToPageSurface(texture, bbox, side, label) {
  const pageOrigin = side === "left" ? [27, 270] : [960, 270];
  const pageTexture = textures.get(`book/surface-${side}.png`);
  const sourceImage = texture.image;
  const maskImage = pageTexture.image;
  const canvas = document.createElement("canvas");
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
  const source = context.getImageData(0, 0, canvas.width, canvas.height);
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = maskImage.width;
  maskCanvas.height = maskImage.height;
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
  maskContext.drawImage(maskImage, 0, 0);
  const mask = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const globalX = bbox[0] + (x + 0.5) / canvas.width * bbox[2];
      const globalY = bbox[1] + (y + 0.5) / canvas.height * bbox[3];
      const maskX = Math.floor(globalX - pageOrigin[0]);
      const maskY = Math.floor(globalY - pageOrigin[1]);
      const sourceIndex = (y * canvas.width + x) * 4 + 3;
      if (maskX < 0 || maskY < 0 || maskX >= maskCanvas.width || maskY >= maskCanvas.height) {
        source.data[sourceIndex] = 0;
        continue;
      }
      const maskAlpha = mask[(maskY * maskCanvas.width + maskX) * 4 + 3];
      source.data[sourceIndex] = Math.round(source.data[sourceIndex] * maskAlpha / 255);
    }
  }
  context.putImageData(source, 0, 0);
  const clipped = configureTexture(new THREE.CanvasTexture(canvas));
  clipped.name = `${label}-page-surface-clipped`;
  return clipped;
}

function makePageRegisteredDecal({
  id,
  texture,
  bbox,
  side,
  opacity = 1,
  color = 0xffffff,
  clipToSurface = false,
}) {
  const registeredTexture = clipToSurface
    ? clipTextureToPageSurface(texture, bbox, side, id)
    : texture;
  const localY = side === "left" ? -1.25 : PAGE_THICKNESS + 1.25;
  const geometry = pageQuadGeometryForScreenBbox(bbox, side, localY);
  const material = clayMode
    ? texturedMaterial(registeredTexture, {
      alphaTest: 0.018,
      paperColor: 0xb7aa96,
      roughness: 0.96,
      side: THREE.DoubleSide,
    })
    : printedMaterial(registeredTexture, {
      alphaTest: 0.018,
      color,
      opacity,
      transparent: opacity < 1,
      side: THREE.DoubleSide,
    });
  const decal = new THREE.Mesh(geometry, material);
  decal.name = id;
  decal.userData.printFront = true;
  decal.userData.pageRegisteredDecal = true;
  decal.castShadow = false;
  decal.receiveShadow = false;
  if (side === "left") {
    leftTextblock.add(decal);
  } else {
    rightTextblock.add(decal);
  }
  const registeredPaintOrder = {
    "obelisk-base-left-page-print": 8,
    "obelisk-base-right-page-print": 8,
    "front-left-microdeck-top-print": 14,
  }[id];
  const decalOrder = registeredPaintOrder
    ?? (id === "taxi-page-print"
      ? 6
      : id.startsWith("far-")
      ? 7
      : id.startsWith("mid-left-")
        ? 13
        : id.startsWith("near-left-") || id.startsWith("near-right-")
          ? (id.includes("page-print") && !id.includes("ground") ? 15 : 14)
          : null);
  applyPsdDepthPriority(decal, decalOrder);
  pageDecals.push({ id, mesh: decal, bbox, side });
  return decal;
}

const CLOSED_BOOK_HEIGHT = PAGE_THICKNESS * 2 + COVER_THICKNESS;
const SPINE_CENTER_Y = CLOSED_BOOK_HEIGHT / 2;
const SPINE_RADIUS_X = 23;
const SPINE_RADIUS_Y = CLOSED_BOOK_HEIGHT / 2;
const SPINE_DEPTH = pageDepth + 25;
const SPINE_SPLIT_ANGLE = Math.acos(
  THREE.MathUtils.clamp((SPINE_CENTER_Y - PAGE_THICKNESS) / SPINE_RADIUS_Y, -1, 1),
);

function curvedSpineSurfaceGeometry({
  angleStart,
  angleEnd,
  radiusX = SPINE_RADIUS_X,
  radiusY = SPINE_RADIUS_Y,
  zStart = -SPINE_DEPTH / 2,
  zEnd = SPINE_DEPTH / 2,
  angleSegments = 18,
  depthSegments = 4,
  yOffset = 0,
}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let depthIndex = 0; depthIndex <= depthSegments; depthIndex += 1) {
    const u = depthIndex / depthSegments;
    const z = THREE.MathUtils.lerp(zStart, zEnd, u);
    for (let angleIndex = 0; angleIndex <= angleSegments; angleIndex += 1) {
      const v = angleIndex / angleSegments;
      const angle = THREE.MathUtils.lerp(angleStart, angleEnd, v);
      positions.push(
        -Math.sin(angle) * radiusX,
        SPINE_CENTER_Y - Math.cos(angle) * radiusY - yOffset,
        z,
      );
      uvs.push(u, v);
    }
  }
  const row = angleSegments + 1;
  for (let depthIndex = 0; depthIndex < depthSegments; depthIndex += 1) {
    for (let angleIndex = 0; angleIndex < angleSegments; angleIndex += 1) {
      const a = depthIndex * row + angleIndex;
      const b = a + row;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function curvedSpineEndCapGeometry({ angleStart, angleEnd, z, yOffset = 0 }) {
  const shape = new THREE.Shape();
  const startY = SPINE_CENTER_Y - Math.cos(angleStart) * SPINE_RADIUS_Y - yOffset;
  shape.moveTo(0, startY);
  const segments = 24;
  for (let index = 0; index <= segments; index += 1) {
    const angle = THREE.MathUtils.lerp(angleStart, angleEnd, index / segments);
    shape.lineTo(
      -Math.sin(angle) * SPINE_RADIUS_X,
      SPINE_CENTER_Y - Math.cos(angle) * SPINE_RADIUS_Y - yOffset,
    );
  }
  const endY = SPINE_CENTER_Y - Math.cos(angleEnd) * SPINE_RADIUS_Y - yOffset;
  shape.lineTo(0, endY);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 1);
  geometry.translate(0, 0, z);
  geometry.computeVertexNormals();
  return geometry;
}

const exteriorSpineEndCaps = [];

function makeSpineSection({ name, angleStart, angleEnd, moving = false }) {
  const group = new THREE.Group();
  group.name = name;
  const yOffset = moving ? PAGE_THICKNESS : 0;
  const shell = new THREE.Mesh(
    curvedSpineSurfaceGeometry({ angleStart, angleEnd, yOffset }),
    exteriorSpineLeather,
  );
  shell.name = `${name}-leather-shell`;
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  for (const [suffix, z] of [
    ["head-cap", SPINE_DEPTH / 2],
    ["tail-cap", -SPINE_DEPTH / 2],
  ]) {
    const cap = new THREE.Mesh(
      curvedSpineEndCapGeometry({ angleStart, angleEnd, z, yOffset }),
      exteriorSpineLeather,
    );
    cap.name = `${name}-${suffix}`;
    cap.userData.closedSpineEndCap = true;
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);
    exteriorSpineEndCaps.push(cap);
  }
  return group;
}

function addSpineRaisedBand(group, {
  name,
  angleStart,
  angleEnd,
  z,
  moving = false,
  material = raisedSpineLeather,
  depth = 7,
  lift = 1.7,
}) {
  const band = new THREE.Mesh(
    curvedSpineSurfaceGeometry({
      angleStart,
      angleEnd,
      radiusX: SPINE_RADIUS_X + lift,
      radiusY: SPINE_RADIUS_Y + lift * 0.55,
      zStart: z - depth / 2,
      zEnd: z + depth / 2,
      depthSegments: 1,
      angleSegments: 18,
      yOffset: moving ? PAGE_THICKNESS : 0,
    }),
    material,
  );
  band.name = name;
  band.castShadow = true;
  band.receiveShadow = true;
  group.add(band);
  return band;
}

function addLongitudinalSpineJoint(group, {
  name,
  angle,
  moving = false,
}) {
  const radius = 1.35;
  const geometry = new THREE.CylinderGeometry(radius, radius, SPINE_DEPTH + 1.5, 10, 1);
  geometry.rotateX(Math.PI / 2);
  const joint = new THREE.Mesh(geometry, spineJointLeather);
  joint.name = name;
  joint.position.set(
    -Math.sin(angle) * (SPINE_RADIUS_X + 0.55),
    SPINE_CENTER_Y - Math.cos(angle) * (SPINE_RADIUS_Y + 0.3) - (moving ? PAGE_THICKNESS : 0),
    0,
  );
  joint.castShadow = true;
  joint.receiveShadow = true;
  group.add(joint);
  return joint;
}

// A case-bound spine is made from two physically related pieces. The lower
// casing stays with the book block; the upper casing follows the cover hinge.
// In the closed pose both halves form one rounded leather volume, while the
// opening naturally separates them instead of making a decorative tube pop
// out of existence.
const fixedSpineCasing = makeSpineSection({
  name: "exterior-spine-fixed",
  angleStart: 0,
  angleEnd: SPINE_SPLIT_ANGLE,
});
bookRoot.add(fixedSpineCasing);

const movingSpineCasing = makeSpineSection({
  name: "exterior-spine-cover",
  angleStart: SPINE_SPLIT_ANGLE,
  angleEnd: Math.PI,
  moving: true,
});

// The two recessed joints are the flexible hinge lines where the leather case
// turns into the cover boards. They give the rounded shell a readable start
// and finish without drawing a fake rectangular outline around it.
addLongitudinalSpineJoint(fixedSpineCasing, {
  name: "exterior-spine-lower-joint",
  angle: 0.12,
});
addLongitudinalSpineJoint(movingSpineCasing, {
  name: "exterior-spine-upper-joint",
  angle: Math.PI - 0.12,
  moving: true,
});

for (const [index, z] of [-0.34, -0.11, 0.12, 0.35].entries()) {
  const bandZ = z * pageDepth;
  addSpineRaisedBand(fixedSpineCasing, {
    name: `exterior-spine-band-${index + 1}-fixed`,
    angleStart: 0,
    angleEnd: SPINE_SPLIT_ANGLE,
    z: bandZ,
  });
  addSpineRaisedBand(movingSpineCasing, {
    name: `exterior-spine-band-${index + 1}-cover`,
    angleStart: SPINE_SPLIT_ANGLE,
    angleEnd: Math.PI,
    z: bandZ,
    moving: true,
  });
}

for (const [suffix, z] of [
  ["head", SPINE_DEPTH / 2 - 2.5],
  ["tail", -SPINE_DEPTH / 2 + 2.5],
]) {
  addSpineRaisedBand(fixedSpineCasing, {
    name: `stitched-${suffix}-band-fixed`,
    angleStart: 0,
    angleEnd: SPINE_SPLIT_ANGLE,
    z,
    material: headbandGold,
    depth: 4.2,
    lift: 2.1,
  });
  addSpineRaisedBand(movingSpineCasing, {
    name: `stitched-${suffix}-band-cover`,
    angleStart: SPINE_SPLIT_ANGLE,
    angleEnd: Math.PI,
    z,
    moving: true,
    material: headbandGold,
    depth: 4.2,
    lift: 2.1,
  });
}

// Leather remains on the lateral/lower spine only. The printed gutter sheet
// must sit above it; the former +10 cap protruded 5 units through the avenue.
const spine = new THREE.Mesh(
  new THREE.BoxGeometry(24, PAGE_THICKNESS, pageDepth + 22),
  clayMode || viewMode === "side" ? bindingLeather : hiddenPageBodySkin,
);
spine.name = "physical-binding-spine";
spine.position.set(0, PAGE_THICKNESS / 2, 0);
spine.castShadow = true;
spine.receiveShadow = true;
bookRoot.add(spine);

// A stitched half-round headband is the only exposed fore-edge of the spine.
// The rectangular +Z face above is intentionally unskinned, so the binding
// reads as a curved burgundy cord behind the converging page lips rather than
// as a vertical plate.
const bindingHead = new THREE.Mesh(
  new THREE.TorusGeometry(10, 3.2, 8, 28, Math.PI),
  bindingLeather,
);
bindingHead.name = "curved-binding-head";
bindingHead.rotation.z = Math.PI;
bindingHead.position.set(0, 10.5, pageDepth / 2 + 11.4);
bindingHead.castShadow = true;
bindingHead.receiveShadow = true;
bookRoot.add(bindingHead);

function taperedGutterCapGeometry() {
  const halfBackWidth = 16;
  const halfFrontWidth = 2;
  const backZ = -pageDepth / 2;
  const frontZ = pageDepth / 2;
  const taperDepth = 62 * sourceToDepth;
  const taperZ = frontZ - taperDepth;
  const taperV = 62 / leftMeta.globalBbox.height;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -halfBackWidth, 0, backZ,
    halfBackWidth, 0, backZ,
    -halfFrontWidth, 0, taperZ,
    halfFrontWidth, 0, taperZ,
  ], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([
    0, 1,
    1, 1,
    0, taperV,
    1, taperV,
  ], 2));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

const gutterTop = new THREE.Mesh(
  taperedGutterCapGeometry(),
  clayMode
    ? solidMaterial(0xbcae99, { roughness: 0.98, side: THREE.DoubleSide })
    : printedMaterial(gutterPrintTexture, { alphaTest: 0.01, side: THREE.DoubleSide }),
);
gutterTop.name = "tapered-gutter-cap";
// The cap nests below the two page lips and ends at their meeting point.  It
// does not continue to the fore edge as a vertical plate; below the narrow V,
// only the burgundy front face of the physical spine remains visible.
gutterTop.position.set(0, PAGE_THICKNESS + 0.12, 0);
gutterTop.receiveShadow = true;
bookRoot.add(gutterTop);

// The cover rotates around the same physical spine as the conserved left
// textblock. Its local vertical offset puts it above the closed stack and,
// after 180deg, below the opened left block. No cover plane can remain beside
// the book after the hinge crosses vertical.
const coverHinge = new THREE.Group();
coverHinge.position.y = PAGE_THICKNESS;
bookRoot.add(coverHinge);
coverHinge.add(movingSpineCasing);

const coverBoard = new THREE.Mesh(
  new THREE.BoxGeometry(leftWidth + 18, COVER_THICKNESS, pageDepth + 20),
  leather,
);
coverBoard.position.set((leftWidth + 18) / 2, PAGE_THICKNESS + COVER_THICKNESS / 2, 0);
coverBoard.castShadow = true;
coverBoard.receiveShadow = true;
coverHinge.add(coverBoard);

const coverFront = new THREE.Mesh(
  new THREE.PlaneGeometry(leftWidth, pageDepth),
  clayMode ? texturedMaterial(textures.get("cover.png"), {
    alphaTest: 0,
    paperColor: 0x4f4138,
    roughness: 0.78,
    side: THREE.FrontSide,
  }) : printedMaterial(textures.get("cover.png"), {
    alphaTest: 0,
    side: THREE.FrontSide,
  }),
);
coverFront.rotation.x = -Math.PI / 2;
coverFront.position.set(leftWidth / 2, PAGE_THICKNESS + COVER_THICKNESS + 0.8, 0);
coverFront.castShadow = true;
coverHinge.add(coverFront);

const coverBack = new THREE.Mesh(
  new THREE.PlaneGeometry(leftWidth, pageDepth),
  solidMaterial(clayMode ? 0x66574d : 0x3c2018, { roughness: 0.9, side: THREE.FrontSide }),
);
coverBack.rotation.x = Math.PI / 2;
coverBack.position.set(leftWidth / 2, PAGE_THICKNESS - 0.8, 0);
coverHinge.add(coverBack);

function facadeGeometry(width, height, u0 = 0, u1 = 1, v0 = 0, v1 = 1) {
  const geometry = new THREE.PlaneGeometry(width, height);
  geometry.translate(0, height / 2, 0);
  const uv = geometry.getAttribute("uv");
  for (let index = 0; index < uv.count; index += 1) {
    uv.setX(index, THREE.MathUtils.lerp(u0, u1, uv.getX(index)));
    uv.setY(index, THREE.MathUtils.lerp(v0, v1, uv.getY(index)));
  }
  uv.needsUpdate = true;
  return geometry;
}

const componentById = new Map(componentManifest.assets.map((item) => [item.id, item]));
const depthPieceById = new Map(depthPlan.pieces.map((item) => [item.id, item]));
const cityPanels = [];
const psdOrderedMaterials = [];

// The PSD is the endpoint compositing authority. The physical rig still owns
// every hinge, silhouette and shadow, but camera-space depth alone cannot
// reproduce Photoshop's explicit paint order when two real paper cards cross.
// Give printed ink a very small depth priority per authored layer. This is not
// renderOrder/always-on-top compositing: the depth buffer remains active and
// surfaces inside the same PSD layer retain their true 3D ordering.
function authoredOrderForRole(role = "") {
  if (role.startsWith("city.taxi")) return 6;
  if (role.startsWith("city.people.far")) return 7;
  if (role.startsWith("city.obelisk")) return 8;
  if (role.startsWith("city.buildings.far.right")) return 10;
  if (role.startsWith("city.buildings.far.left")) return 11;
  if (role.startsWith("city.buildings.mid.right")) return 12;
  if (role.startsWith("city.buildings.mid.left")) return 13;
  if (role.startsWith("city.buildings.near")) return 14;
  if (role.startsWith("city.people.near")) return 15;
  return null;
}

function applyPsdDepthPriorityToMaterial(material, order) {
  if (!psdOrderMode || clayMode || order == null || material.userData.psdOrderApplied) return;
  const biasUniform = { value: 0 };
  const previousOnBeforeCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (shader, rendererContext) => {
    previousOnBeforeCompile?.(shader, rendererContext);
    shader.uniforms.psdDepthBias = biasUniform;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nuniform float psdDepthBias;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "gl_FragDepth = clamp(gl_FragCoord.z - psdDepthBias, 0.0, 1.0);\n#include <opaque_fragment>",
    );
  };
  material.customProgramCacheKey = () => `${previousCacheKey?.() ?? "material"}-psd-order-${order}`;
  material.userData.psdOrderApplied = true;
  material.userData.psdPaintOrder = order;
  material.userData.psdDepthUniform = biasUniform;
  psdOrderedMaterials.push({ material, order, uniform: biasUniform });
  material.needsUpdate = true;
}

function applyPsdDepthPriority(root, order) {
  if (order == null) return;
  root.traverse((object) => {
    if (!object.isMesh || !object.userData.printFront) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) applyPsdDepthPriorityToMaterial(material, order);
    object.userData.psdPaintOrder = order;
  });
}

// Camera-space deprojection contract for the approved PSD endpoint.  These
// values alter the fixed paper dimensions/anchors, never scale a piece during
// deployment.  The v0.4 hinge drivers and easing remain untouched.
const V05_LAYOUT = Object.freeze({
  rear_skyline_left: hybridSpike
    ? { yawDeg: 0 }
    : { xMm: -84.5, zMm: 120.4, widthScale: 1.192, heightScale: 1.266, targetDeg: 87, yawDeg: 4 },
  rear_skyline_right: hybridSpike
    ? { yawDeg: 0 }
    : { xMm: 90.1, zMm: 110.2, widthScale: 1.141, heightScale: 1.367, targetDeg: 88, yawDeg: -4 },
  mid_right_dome: { xMm: 37, zMm: 55, widthScale: 0.765, heightScale: 1.628, targetDeg: 84, yawDeg: 5, deprojectBbox: hybridSpike ? [1014, 128, 238, 568] : undefined },
  mid_right_terminal: { xMm: 90.5, zMm: 54.3, widthScale: 0.668, heightScale: 1.571, targetDeg: 85, yawDeg: -1, deprojectBbox: hybridSpike ? [1210, 88, 320, 591] : undefined },
  mid_right_church: { xMm: 129.4, zMm: 57, widthScale: 0.339, heightScale: 2.192, targetDeg: 86, yawDeg: -6, deprojectBbox: hybridSpike ? [1497, 88, 205, 584] : undefined },
  mid_left_clock_door: { xMm: -91.7, zMm: 10, widthScale: 0.262, heightScale: 2.256, targetDeg: 82, yawDeg: 5, deprojectBbox: hybridSpike ? [306, 98, 237, 830] : undefined },
  mid_left_right_tower: { xMm: -33.5, zMm: 58, widthScale: 0.681, heightScale: 1.658, targetDeg: 86, yawDeg: -4, deprojectBbox: hybridSpike ? [717, 228, 173, 460] : undefined },
  mid_left_hall_wedge: { xMm: -71.7, zMm: 30.3, widthScale: 0.548, depthScale: 1.427, targetDeg: 74, yawDeg: 1, deprojectBbox: hybridSpike ? [488, 168, 258, 641] : undefined },
  front_deck_left: hybridSpike
    ? { xMm: -70, zMm: 4, targetDeg: 118, yawDeg: 0, deprojectBbox: [350, 694, 473, 145] }
    : { xMm: -68.2, zMm: 17, widthScale: 0.886, depthScale: 0.437, elevationMm: 6, targetDeg: 4 },
  front_deck_right: { xMm: 63, zMm: 6, widthScale: 0.768, depthScale: 0.281, elevationMm: 0.5, targetDeg: 0 },
  "near-left-west-gate": { xMm: -115, zMm: 31, widthScale: 0.371, heightScale: 1.299 },
  "near-right-back-facades": { xMm: 70.5, zMm: 43, widthScale: 0.999, heightScale: 0.875, deprojectBbox: hybridSpike ? [960, 502, 722, 206] : undefined },
  "near-right-clock-tower": {
    xMm: 140,
    zMm: 30,
    widthScale: 0.231,
    heightScale: 1.102,
    deprojectBbox: hybridSpike ? [1673, 529, 115, 347] : undefined,
  },
  "far-left-04": { xMm: -25, zMm: 68, yawDeg: 0, deprojectBbox: hybridSpike ? [814, 502, 64, 124] : undefined },
  "far-left-03": { xMm: -62, zMm: 61, yawDeg: 0, deprojectBbox: hybridSpike ? [622, 581, 31, 74] : undefined },
  "far-right-01": { xMm: 19.3, zMm: 73, yawDeg: 0, deprojectBbox: hybridSpike ? [1010, 492, 80, 135] : undefined },
  "far-right-03": { xMm: 79.5, zMm: 98, yawDeg: 0, deprojectBbox: hybridSpike ? [1300, 386, 42, 94] : undefined },
  "near-left-01": { zMm: 14, yawDeg: 0, deprojectBbox: hybridSpike ? [137, 809, 36, 92] : undefined },
  "near-left-04": { zMm: 15, yawDeg: 0, deprojectBbox: hybridSpike ? [732, 825, 35, 84] : undefined },
  "near-left-05": { zMm: 31, yawDeg: 0, deprojectBbox: hybridSpike ? [788, 617, 28, 64] : undefined },
  "near-left-06": { zMm: 33, yawDeg: 0, deprojectBbox: hybridSpike ? [807, 719, 34, 77] : undefined },
  "near-left-07": { zMm: 34, yawDeg: 0, deprojectBbox: hybridSpike ? [841, 744, 38, 79] : undefined },
  "near-left-08": { zMm: 34, yawDeg: 0, deprojectBbox: hybridSpike ? [888, 695, 38, 72] : undefined },
  "near-left-10": { zMm: 32, yawDeg: 0, deprojectBbox: hybridSpike ? [929, 743, 31, 71] : undefined },
  obelisk_cross: { zMm: 99, widthScale: 1.039, heightScale: 1.146, xOffsetMm: -1, sideDepthScale: 0.04 },
});

function applyV05Layout(config) {
  if (config.ignoreV05Layout) return config;
  const adjustment = V05_LAYOUT[config.id];
  if (!adjustment) return config;
  return {
    ...config,
    xMm: adjustment.xMm ?? config.xMm,
    zMm: adjustment.zMm ?? config.zMm,
    widthMm: config.widthMm * (adjustment.widthScale ?? 1),
    heightMm: config.heightMm == null
      ? config.heightMm
      : config.heightMm * (adjustment.heightScale ?? 1),
    depthMm: config.depthMm == null
      ? config.depthMm
      : config.depthMm * (adjustment.depthScale ?? adjustment.heightScale ?? 1),
    elevationMm: adjustment.elevationMm ?? config.elevationMm,
    targetDeg: adjustment.targetDeg ?? config.targetDeg,
    yawDeg: adjustment.yawDeg ?? config.yawDeg,
    deprojectBbox: adjustment.deprojectBbox ?? config.deprojectBbox,
    printColor: adjustment.printColor ?? config.printColor,
  };
}

function componentTexture(id) {
  const component = componentById.get(id);
  if (!component) throw new Error(`Missing physical component asset: ${id}`);
  return textures.get(`components/${component.file}`);
}

function mechanicalProgress(leftDeg, motion = {}) {
  const start = motion.openStartDeg ?? 70;
  const finish = motion.openFinishDeg ?? 164;
  return smooth01(THREE.MathUtils.clamp((leftDeg - start) / Math.max(1, finish - start), 0, 1));
}

function makePaperCutout(texture, width, height, options = {}) {
  const geometry = facadeGeometry(width, height);
  const cutout = new THREE.Group();
  const thickness = options.thickness ?? 5;

  // One alpha-masked paper core replaces the former stack of 5–7 repeated
  // mattes. Those shells produced texture-like moire at oblique angles. The
  // core is solid paper colour and exists only once between front and back.
  const core = new THREE.Mesh(
    geometry,
    texturedMaterial(texture, {
      alphaTest: 0.018,
      paperColor: cityBackPaper,
      roughness: 0.98,
      side: THREE.DoubleSide,
    }),
  );
  core.material.shadowSide = THREE.DoubleSide;
  // The core is a silhouette/shadow carrier, not a second full-area paper
  // face. Deprojected pieces can flip winding, so culling cannot reliably keep
  // it behind the reverse. In normal rendering it writes neither colour nor
  // depth; the alpha-identical front/back sheets own both visible faces.
  if (!clayMode) {
    core.material.colorWrite = false;
    core.material.depthWrite = false;
  }
  core.castShadow = true;
  core.receiveShadow = true;
  core.userData.paperLayer = "core";
  cutout.add(core);

  const front = new THREE.Mesh(
    geometry,
    clayMode ? texturedMaterial(texture, {
      alphaTest: 0.018,
      paperColor: options.clayColor ?? 0xb7aa96,
      roughness: 0.9,
      side: THREE.FrontSide,
    }) : printedMaterial(texture, {
      alphaTest: 0.018,
      color: options.printColor ?? 0xffffff,
      side: THREE.FrontSide,
    }),
  );
  front.position.z = thickness / 2 + 0.35;
  front.userData.printFront = true;
  front.userData.paperLayer = "front";
  // The core alone owns the silhouette shadow.  Front/back shadow casters
  // produced three coincident outlines and the characteristic v0.4 halo.
  front.castShadow = false;
  front.receiveShadow = false;
  cutout.add(front);

  const back = new THREE.Mesh(
    geometry,
    clayMode
      ? texturedMaterial(texture, {
        alphaTest: 0.018,
        paperColor: cityBackPaper,
        roughness: 0.98,
        side: THREE.BackSide,
      })
      : unlitPaperMaskMaterial(texture, 0x7d7263, {
        alphaTest: 0.018,
        side: THREE.DoubleSide,
      }),
  );
  back.position.z = -thickness / 2 - 0.35;
  back.userData.paperLayer = "back";
  back.castShadow = false;
  back.receiveShadow = clayMode;
  cutout.add(back);

  cutout.userData.paperLayers = { core, front, back };

  return cutout;
}

function addFootHardware(root, width, railWidth = width * 0.76) {
  const tabWidth = Math.min(16, Math.max(10, width * 0.11));
  const tabOffset = Math.min(width * 0.29, Math.max(9, width / 3));
  for (const x of [-tabOffset, tabOffset]) {
    const tab = new THREE.Mesh(new THREE.BoxGeometry(tabWidth, 3.2, 16), hingePaper);
    tab.userData.rigHardware = true;
    tab.position.set(x, 1.6, 7);
    tab.castShadow = true;
    tab.receiveShadow = true;
    root.add(tab);
  }
}

function registerMechanism(entry) {
  const registered = {
    ...entry,
    item: { role: entry.role, side: entry.side },
    orientation: entry.root,
    hinges: entry.hinges ?? [],
    spec: {
      type: entry.mechanism,
      targetDeg: entry.targetDeg ?? 0,
    },
  };
  cityPanels.push(registered);
  registered.root.traverse((object) => {
    object.userData.interactionMechanismId = registered.id;
  });
  applyPsdDepthPriority(registered.root, authoredOrderForRole(registered.role));
  return registered;
}

function makeHingedComponent(config) {
  config = applyV05Layout(config);
  const width = config.widthMm * xWorldPerMm;
  const height = config.heightMm * yWorldPerMm;
  const root = new THREE.Group();
  let side = config.side;
  const anchorXWorld = xMmToWorld(config.xMm);
  const baseZ = zMmToWorld(config.zMm);
  // Fold toward whichever page edge has enough physical room for this card.
  // This keeps every closed silhouette inside the 1285-unit page footprint.
  const foldSign = config.foldSign ?? (baseZ - height >= -pageDepth / 2 + 12 ? -1 : 1);

  if (config.parentContext) {
    const parent = config.parentContext;
    root.position.set(
      xMmToWorld(config.xMm - parent.anchorXmm),
      3.4,
      zMmToWorld(config.zMm) - zMmToWorld(parent.anchorZmm),
    );
    parent.group.add(root);
    side = parent.side;
  } else {
    root.position.z = baseZ;
    side = attachToFacingPage(
      root,
      anchorXWorld,
      (config.hingePocketMm ?? 0) * yWorldPerMm,
    );
  }

  // Yaw belongs to the hinge line on the page, not to the artwork inside the
  // hinge. Applying yaw to the cutout first makes its folded footprint leave
  // the page plane and puncture the sheet halfway through the opening.
  const yawFrame = new THREE.Group();
  const hinge = new THREE.Group();
  const cutout = makePaperCutout(config.texture, width, height, {
    thickness: config.thickness ?? 5,
    edgeLayers: config.edgeLayers ?? 5,
    clayColor: config.clayColor,
    printColor: config.printColor,
  });
  hinge.add(cutout);

  if (!config.concealHardware) {
    const requestedRailWidth = Math.max(
      12,
      (config.railWidthMm ?? config.widthMm * 0.72) * xWorldPerMm,
    );
    const railSegmentWidth = Math.min(72, Math.max(12, requestedRailWidth * 0.3));
    const railOffsets = width > 96 ? [-width * 0.28, width * 0.28] : [0];
    for (const railX of railOffsets) {
      const movingRail = new THREE.Mesh(
        new THREE.BoxGeometry(railSegmentWidth, 4, 4),
        hingePaper,
      );
      movingRail.userData.rigHardware = true;
      movingRail.position.set(railX, 2, 0);
      movingRail.castShadow = true;
      movingRail.receiveShadow = true;
      hinge.add(movingRail);
    }
  }
  yawFrame.add(hinge);
  root.add(yawFrame);
  if (!config.concealHardware) {
    addFootHardware(root, width, (config.railWidthMm ?? config.widthMm * 0.72) * xWorldPerMm);
  }

  const entry = registerMechanism({
    id: config.id,
    role: config.role,
    mechanism: config.mechanism ?? "hinged-cutout-card",
    root,
    side,
    anchorXWorld,
    baseZ,
    targetDeg: config.targetDeg,
    hinges: [hinge],
    update(leftDeg) {
      const rise = mechanicalProgress(leftDeg, config.motion);
      const yawDeploy = smooth01(THREE.MathUtils.clamp((rise - 0.68) / 0.32, 0, 1));
      yawFrame.rotation.y = THREE.MathUtils.degToRad((config.yawDeg ?? 0) * yawDeploy);
      const currentDeg = THREE.MathUtils.lerp(
        90 * foldSign,
        (90 - config.targetDeg) * foldSign,
        rise,
      );
      hinge.rotation.x = THREE.MathUtils.degToRad(currentDeg);
      this.rise = rise;
    },
  });
  if (config.deprojectBbox) {
    const { core, front, back } = cutout.userData.paperLayers;
    queuePhysicalDeprojection(
      entry,
      [core, front, back],
      config.deprojectBbox,
      config.id,
      8,
      new THREE.Vector3(0, 0, 1),
      { hingeZInsetMm: config.hingeZInsetMm ?? 0 },
    );
  }
  return entry;
}

// Two printed leaves share the page hinge and close around a real vertical
// paper seam. At the endpoint the seam is flat (pixel-identical registration);
// at closure the second leaf turns 180 degrees and stacks over the first, so a
// tall/wide facade fits inside its owning page without scaling or clipping.
function makeVerticalAccordionPair(config) {
  config = applyV05Layout(config);
  const root = new THREE.Group();
  root.position.z = zMmToWorld(config.zMm);
  const anchorXWorld = xMmToWorld(config.xMm);
  const side = attachToFacingPage(
    root,
    anchorXWorld,
    (config.hingePocketMm ?? 0) * yWorldPerMm,
  );
  const yawFrame = new THREE.Group();
  const pageHinge = new THREE.Group();
  const seamHinge = new THREE.Group();
  const pocketDepth = (config.pocketDepthMm ?? 0) * zWorldPerMm;
  const pocketHinge = new THREE.Group();
  const pocketFace = new THREE.Group();
  pocketFace.position.z = pocketDepth;
  const height = config.heightMm * yWorldPerMm;
  const totalPixels = config.leaves.reduce((sum, leaf) => sum + leaf.bbox[2], 0);
  const leafCutouts = config.leaves.map((leaf) => {
    const width = config.widthMm * (leaf.bbox[2] / totalPixels) * xWorldPerMm;
    return makePaperCutout(leaf.texture, width, height, {
      thickness: config.thickness ?? 1.8,
      clayColor: config.clayColor,
      printColor: config.printColor,
    });
  });
  const baseLeafIndex = config.baseLeafIndex ?? 0;
  const foldingLeafIndex = baseLeafIndex === 0 ? 1 : 0;
  pageHinge.add(leafCutouts[baseLeafIndex]);
  seamHinge.add(leafCutouts[foldingLeafIndex]);
  pageHinge.add(seamHinge);
  yawFrame.add(pageHinge);
  pocketFace.add(yawFrame);
  pocketHinge.add(pocketFace);
  root.add(pocketHinge);

  if (pocketDepth > 0) {
    const pocketStrip = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(8, (config.pocketWidthMm ?? config.widthMm) * xWorldPerMm * 0.92),
        1.2,
        pocketDepth,
      ),
      hingePaper,
    );
    pocketStrip.position.set(0, 0.6, pocketDepth / 2);
    pocketStrip.userData.rigHardware = true;
    pocketStrip.visible = clayMode || viewMode === "side";
    pocketHinge.add(pocketStrip);
  }

  const baseZ = root.position.z;
  const foldSign = config.foldSign
    ?? (baseZ - height >= -pageDepth / 2 + 12 ? -1 : 1);
  const entry = registerMechanism({
    id: config.id,
    role: config.role,
    mechanism: config.mechanism ?? "vertical-seam-accordion-card",
    root,
    side,
    anchorXWorld,
    baseZ,
    targetDeg: config.targetDeg,
    hinges: [pocketHinge, pageHinge, seamHinge],
    update(leftDeg) {
      const rise = mechanicalProgress(leftDeg, config.faceMotion ?? config.motion);
      const pocketStart = config.motion?.openStartDeg ?? 50;
      const pocketFinish = config.pocketFinishDeg ?? 108;
      const pocketRise = pocketDepth > 0
        ? smooth01(THREE.MathUtils.clamp(
          (leftDeg - pocketStart) / Math.max(1, pocketFinish - pocketStart),
          0,
          1,
        ))
        : 1;
      pocketHinge.rotation.x = THREE.MathUtils.lerp(-Math.PI, 0, pocketRise);
      const yawDeploy = smooth01(THREE.MathUtils.clamp((rise - 0.68) / 0.32, 0, 1));
      yawFrame.rotation.y = THREE.MathUtils.degToRad((config.yawDeg ?? 0) * yawDeploy);
      const authoredFaceAngle = THREE.MathUtils.degToRad(
        THREE.MathUtils.lerp(
          90 * foldSign,
          (90 - config.targetDeg) * foldSign,
          rise,
        ),
      );
      // Counter-rotate the second hinge while the pocket return turns. This is
      // a compact parallel Z-fold: the artwork keeps the same causal face
      // angle as the accepted page hinge, while the common return translates
      // both connected leaves safely inward at closure.
      pageHinge.rotation.x = authoredFaceAngle - pocketHinge.rotation.x;
      const seamDeploy = smooth01(THREE.MathUtils.clamp((rise - 0.28) / 0.72, 0, 1));
      seamHinge.rotation.y = THREE.MathUtils.lerp(
        Math.PI * (config.seamFoldSign ?? 1),
        0,
        seamDeploy,
      );
      this.rise = rise;
    },
  });

  const seamScreenX = config.leaves[0].bbox[0] + config.leaves[0].bbox[2];
  const seamScreenY = config.overallBbox[1] + config.overallBbox[3];
  const placePocketInsideTrim = () => {
    if (pocketDepth <= 0 || root.userData.pocketPlaced) return;
    root.position.z -= pocketDepth;
    entry.baseZ = root.position.z;
    root.userData.pocketPlaced = true;
  };
  const placeAuthoredSeam = () => {
    placePocketInsideTrim();
    root.updateWorldMatrix(true, true);
    const reference = leafCutouts[baseLeafIndex].userData.paperLayers.core;
    reference.updateWorldMatrix(true, false);
    heroCamera.updateMatrixWorld(true);
    const referenceMatrix = reference.matrixWorld.clone();
    const planePoint = new THREE.Vector3().applyMatrix4(referenceMatrix);
    const planeNormal = new THREE.Vector3(0, 0, 1)
      .applyMatrix3(new THREE.Matrix3().getNormalMatrix(referenceMatrix))
      .normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, planePoint);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(
      new THREE.Vector2(
        seamScreenX / WIDTH * 2 - 1,
        1 - seamScreenY / HEIGHT * 2,
      ),
      heroCamera,
    );
    const seamWorld = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (!seamWorld) throw new Error(`Cannot place accordion seam for ${config.id}`);
    const seamLocal = seamWorld.applyMatrix4(pageHinge.matrixWorld.clone().invert());
    seamHinge.position.set(seamLocal.x, 0, 0);
  };

  config.leaves.forEach((leaf, index) => {
    const { core, front, back } = leafCutouts[index].userData.paperLayers;
    queuePhysicalDeprojection(
      entry,
      [core, front, back],
      leaf.bbox,
      leaf.id,
      8,
      new THREE.Vector3(0, 0, 1),
      {
        hingeBbox: config.overallBbox,
        beforeGeometry: index === 0 ? placeAuthoredSeam : undefined,
      },
    );
  });
  return entry;
}

// Wide skyline cards cannot plausibly close inside a leaf as one rectangle.
// The v0.5 physical version treats authored party walls as a row of narrow,
// page-bound accordion leaves. Every leaf owns its hinge and the same
// left-page-angle driver, so the endpoint seams register exactly while the
// closed footprint is the width of one semantic bay rather than the full row.
function makeNarrowAccordionLeaves(config) {
  const totalPixels = config.leaves.reduce((sum, leaf) => sum + leaf.bbox[2], 0);
  const componentFactory = config.pocketDepthMm
    ? makePocketHingedComponent
    : makeHingedComponent;
  return config.leaves.map((leaf, index) => componentFactory({
    id: leaf.id,
    role: `${config.role}.leaf-${index + 1}`,
    mechanism: "narrow-architectural-accordion-leaf",
    texture: leaf.texture,
    xMm: config.xMm,
    zMm: config.zMm,
    widthMm: config.widthMm * (leaf.bbox[2] / totalPixels),
    heightMm: config.heightMm,
    targetDeg: config.targetDeg,
    yawDeg: config.yawDeg ?? 0,
    foldSign: leaf.foldSign ?? config.foldSign,
    thickness: config.thickness ?? 1.8,
    hingePocketMm: leaf.hingePocketMm ?? config.hingePocketMm ?? 0,
    hingeZInsetMm: leaf.hingeZInsetMm ?? config.hingeZInsetMm ?? 0,
    pocketDepthMm: leaf.pocketDepthMm ?? config.pocketDepthMm,
    pocketFinishDeg: leaf.pocketFinishDeg ?? config.pocketFinishDeg,
    pocketWidthMm: leaf.pocketWidthMm ?? config.pocketWidthMm,
    pocketInsetMm: leaf.pocketInsetMm ?? config.pocketInsetMm,
    faceMotion: leaf.faceMotion ?? config.faceMotion,
    concealHardware: true,
    deprojectBbox: leaf.bbox,
    motion: leaf.motion ?? config.motion,
    ignoreV05Layout: true,
  }));
}

// A page-edge pocket lets a tall facade keep its authored endpoint hinge while
// closing safely inside the trim. The short return folds inward first; the
// facade then rises from the same left-page angle. At no point is the artwork
// translated or scaled after deprojection.
function makePocketHingedComponent(config) {
  const width = config.widthMm * xWorldPerMm;
  const height = config.heightMm * yWorldPerMm;
  const pocketDepth = config.pocketDepthMm * zWorldPerMm;
  const root = new THREE.Group();
  root.position.z = zMmToWorld(config.zMm);
  const anchorXWorld = xMmToWorld(config.xMm);
  const side = attachToFacingPage(
    root,
    anchorXWorld,
    (config.hingePocketMm ?? 0) * yWorldPerMm,
  );
  const pocketHinge = new THREE.Group();
  const faceRoot = new THREE.Group();
  faceRoot.position.z = pocketDepth;
  const yawFrame = new THREE.Group();
  const faceHinge = new THREE.Group();
  const cutout = makePaperCutout(config.texture, width, height, {
    thickness: config.thickness ?? 1.4,
  });
  faceHinge.add(cutout);
  yawFrame.add(faceHinge);
  faceRoot.add(yawFrame);
  pocketHinge.add(faceRoot);
  root.add(pocketHinge);

  const pocketStrip = new THREE.Mesh(
    new THREE.BoxGeometry(
      Math.max(8, (config.pocketWidthMm ?? config.widthMm * 0.72) * xWorldPerMm),
      1.2,
      pocketDepth,
    ),
    hingePaper,
  );
  pocketStrip.position.set(
    (config.pocketInsetMm ?? 0) * xWorldPerMm,
    0.6,
    pocketDepth / 2,
  );
  pocketStrip.userData.rigHardware = true;
  pocketStrip.visible = clayMode || viewMode === "side";
  pocketHinge.add(pocketStrip);

  const entry = registerMechanism({
    id: config.id,
    role: config.role,
    mechanism: "compound-page-pocket-facade",
    root,
    side,
    anchorXWorld,
    baseZ: root.position.z,
    targetDeg: config.targetDeg,
    hinges: [pocketHinge, faceHinge],
    update(leftDeg) {
      const rise = mechanicalProgress(leftDeg, config.faceMotion ?? config.motion);
      const pocketStart = config.motion?.openStartDeg ?? 50;
      const pocketFinish = config.pocketFinishDeg ?? 108;
      const pocketRise = smooth01(THREE.MathUtils.clamp(
        (leftDeg - pocketStart) / Math.max(1, pocketFinish - pocketStart),
        0,
        1,
      ));
      // Negative rotation raises the return above the page during deployment;
      // the opposite sign would sweep the strip through the textblock.
      pocketHinge.rotation.x = THREE.MathUtils.lerp(-Math.PI, 0, pocketRise);
      const yawDeploy = smooth01(THREE.MathUtils.clamp((rise - 0.68) / 0.32, 0, 1));
      yawFrame.rotation.y = THREE.MathUtils.degToRad((config.yawDeg ?? 0) * yawDeploy);
      const authoredFaceAngle = THREE.MathUtils.degToRad(
        THREE.MathUtils.lerp(-90, -(90 - config.targetDeg), rise),
      );
      // Keep the card's world angle fixed while the concealed page return
      // clears, then let the authored face rise. This is one causal Z-fold,
      // not two independent animations.
      faceHinge.rotation.x = authoredFaceAngle - pocketHinge.rotation.x;
      this.rise = rise;
    },
  });

  const placePocketInsideTrim = () => {
    if (root.userData.pocketPlaced) return;
    root.position.z -= pocketDepth;
    entry.baseZ = root.position.z;
    root.userData.pocketPlaced = true;
  };
  const { core, front, back } = cutout.userData.paperLayers;
  queuePhysicalDeprojection(
    entry,
    [core, front, back],
    config.deprojectBbox,
    config.id,
    8,
    new THREE.Vector3(0, 0, 1),
    { beforeGeometry: placePocketInsideTrim },
  );
  return entry;
}

function deckShapesFromContours(contourData, width, depth) {
  const outerContours = contourData.contours.filter((contour) => contour.kind === "outer");
  return outerContours.map((outer) => {
    const outerPoints = outer.pointsThreeLocal.map(
      ([x, y]) => new THREE.Vector2(x * width, y * depth),
    );
    const shape = new THREE.Shape(outerPoints);
    shape.autoClose = true;
    for (const hole of contourData.contours.filter(
      (contour) => contour.kind === "hole" && contour.parentOuterId === outer.id,
    )) {
      const path = new THREE.Path(
        hole.pointsThreeLocal.map(([x, y]) => new THREE.Vector2(x * width, y * depth)),
      );
      path.autoClose = true;
      shape.holes.push(path);
    }
    return shape;
  });
}

function deckSurfaceGeometry(shapes, width, depth) {
  const geometry = new THREE.ShapeGeometry(shapes, 1);
  const positions = geometry.getAttribute("position");
  const uv = new Float32Array(positions.count * 2);
  for (let index = 0; index < positions.count; index += 1) {
    uv[index * 2] = THREE.MathUtils.clamp(positions.getX(index) / width + 0.5, 0, 1);
    uv[index * 2 + 1] = THREE.MathUtils.clamp(positions.getY(index) / depth + 0.5, 0, 1);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function makeDeck(config) {
  config = applyV05Layout(config);
  const width = config.widthMm * xWorldPerMm;
  const depth = config.depthMm * zWorldPerMm;
  const wallHeight = config.elevationMm * yWorldPerMm;
  const root = new THREE.Group();
  root.position.z = zMmToWorld(config.zMm);
  const anchorXWorld = xMmToWorld(config.xMm);
  const side = attachToFacingPage(root, anchorXWorld, hybridSpike ? 2 : 0);

  const frame = new THREE.Group();
  // The deck footprint stays aligned to its page so all four folded walls fit
  // inside the closed block. Character comes from the mounted relief cards.
  frame.rotation.y = 0;
  root.add(frame);

  const footprint = deckFootprintByMechanism.get(config.id);
  if (!footprint) throw new Error(`Missing die-cut deck footprint for ${config.id}`);
  const contourData = deckContourById.get(footprint.id);
  if (!contourData) throw new Error(`Missing contour data for ${footprint.id}`);
  const deckShapes = deckShapesFromContours(contourData, width, depth);

  const deckTop = new THREE.Group();
  const deckBodyGeometry = new THREE.ExtrudeGeometry(deckShapes, {
    depth: 5,
    bevelEnabled: false,
    curveSegments: 1,
  });
  deckBodyGeometry.rotateX(-Math.PI / 2);
  const deckBody = new THREE.Mesh(
    deckBodyGeometry,
    pagePaper,
  );
  deckBody.position.set(0, 0, -depth / 2);
  deckBody.castShadow = true;
  deckBody.receiveShadow = true;
  deckTop.add(deckBody);

  const deckPrint = new THREE.Mesh(
    deckSurfaceGeometry(deckShapes, width, depth),
    clayMode ? texturedMaterial(textures.get(footprint.surfaceFile.replace(/^assets\//, "")), {
      alphaTest: 0.045,
      paperColor: 0xb7aa96,
      roughness: 0.94,
      // Keep the printed skin decisively in front of the extruded deck top.
      // At the former 0.4-unit separation the two rasterized surfaces became
      // coplanar at a pair of oblique opening poses, producing a one-frame
      // screen-door pattern on each deck.
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }) : printedMaterial(textures.get(footprint.surfaceFile.replace(/^assets\//, "")), {
      alphaTest: 0.018,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  deckPrint.userData.printFront = true;
  deckPrint.position.set(0, 6.35, -depth / 2);
  // The extruded body already casts the deck mass. Letting the print cast a
  // second alpha-tested shadow creates self-shadow acne at grazing angles.
  deckPrint.castShadow = false;
  deckPrint.receiveShadow = true;
  deckTop.add(deckPrint);
  frame.add(deckTop);

  function liftStrut(x, z, strutHeight) {
    const strutHinge = new THREE.Group();
    strutHinge.position.set(x, 0, z);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(12, strutHeight, 4),
      hingePaper,
    );
    strip.userData.rigHardware = true;
    strip.position.y = strutHeight / 2;
    strip.castShadow = true;
    strip.receiveShadow = true;
    strutHinge.add(strip);
    frame.add(strutHinge);
    return strutHinge;
  }

  // Four narrow parallel-fold struts replace the former full-width box walls.
  // Their lengths solve against the tilted top, so each strip touches the
  // die-cut underside at final pose and folds wholly inside its footprint.
  const finalSin = Math.sin(THREE.MathUtils.degToRad(config.targetDeg ?? 0));
  const rearHeight = (wallHeight + depth * finalSin) / (1 + finalSin);
  const supportStruts = [
    liftStrut(-width * 0.28, 0, wallHeight),
    liftStrut(width * 0.28, 0, wallHeight),
    liftStrut(-width * 0.22, -depth + rearHeight, rearHeight),
    liftStrut(width * 0.22, -depth + rearHeight, rearHeight),
  ];
  addFootHardware(frame, width, width * 0.82);

  const entry = registerMechanism({
    id: config.id,
    role: config.role,
    mechanism: "parallel-box-fold-deck",
    root,
    side,
    anchorXWorld,
    baseZ: root.position.z,
    targetDeg: config.targetDeg,
    hinges: supportStruts,
    update(leftDeg) {
      const rise = mechanicalProgress(leftDeg, config.motion);
      const arc = rise * Math.PI / 2;
      const strutAngle = THREE.MathUtils.lerp(-Math.PI / 2, 0, rise);
      supportStruts.forEach((strut) => {
        strut.rotation.x = strutAngle;
      });
      deckTop.position.y = wallHeight * Math.sin(arc) + 0.4;
      deckTop.position.z = 0;
      // Positive X lifts the rear edge (negative local Z) above the page.
      // The previous sign drove the entire deck through the paper block.
      deckTop.rotation.x = THREE.MathUtils.degToRad((config.targetDeg ?? 0) * rise);
      this.rise = rise;
    },
  });

  entry.topContext = {
    group: deckTop,
    anchorXmm: config.xMm,
    anchorZmm: config.zMm,
    side,
  };
  entry.deckBody = deckBody;
  entry.deckPrint = deckPrint;
  if (config.deprojectBbox) {
    queuePhysicalDeprojection(
      entry,
      [deckPrint],
      config.deprojectBbox,
      config.id,
      8,
      new THREE.Vector3(0, 1, 0),
    );
  }
  return entry;
}

function makeShallowPlatform(config) {
  const root = new THREE.Group();
  root.position.z = zMmToWorld(config.zMm);
  const anchorXWorld = xMmToWorld(config.xMm);
  const side = attachToFacingPage(root, anchorXWorld);
  const top = new THREE.Group();
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(config.widthMm * xWorldPerMm, config.depthMm * zWorldPerMm),
    clayMode
      ? texturedMaterial(config.texture, {
        alphaTest: 0.018,
        paperColor: 0xb7aa96,
        roughness: 0.96,
        side: THREE.DoubleSide,
      })
      : printedMaterial(config.texture, { alphaTest: 0.018, side: THREE.DoubleSide }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.userData.printFront = true;
  surface.userData.paperLayer = "front";
  surface.castShadow = true;
  surface.receiveShadow = true;
  top.add(surface);
  root.add(top);
  const elevationWorld = config.elevationMm * yWorldPerMm;
  const platformWidth = config.widthMm * xWorldPerMm;
  const supportHinges = [-platformWidth * 0.31, platformWidth * 0.31].map((x, index) => {
    const hinge = new THREE.Group();
    hinge.position.x = x;
    const link = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, elevationWorld, 2.2),
      hingePaper,
    );
    link.position.y = elevationWorld / 2;
    link.castShadow = true;
    link.receiveShadow = true;
    link.userData.rigHardware = true;
    link.name = `${config.id}-parallel-link-${index + 1}`;
    // The linkages remain real geometry and are exposed by the physical
    // review views, but sit entirely behind the fascia in the normal hero.
    link.visible = clayMode || viewMode === "side";
    hinge.add(link);
    root.add(hinge);
    return hinge;
  });

  const entry = registerMechanism({
    id: config.id,
    role: config.role,
    mechanism: "shallow-parallel-four-bar-platform",
    root,
    side,
    anchorXWorld,
    baseZ: root.position.z,
    targetDeg: 0,
    hinges: supportHinges,
    update(leftDeg) {
      const rise = mechanicalProgress(leftDeg, config.motion);
      const linkArc = rise * Math.PI / 2;
      const linkAngle = THREE.MathUtils.lerp(-Math.PI / 2, 0, rise);
      supportHinges.forEach((hinge) => {
        hinge.rotation.x = linkAngle;
      });
      // The top remains parallel to the page because both equal links carry
      // it through the same circular arc. At closure it nests flat behind the
      // fascia; at the endpoint it reaches the authored 6 mm elevation.
      top.position.y = elevationWorld * Math.sin(linkArc);
      top.position.z = -elevationWorld * Math.cos(linkArc);
      this.rise = rise;
    },
  });
  queuePhysicalDeprojection(
    entry,
    [surface],
    config.deprojectBbox,
    config.id,
    8,
    // PlaneGeometry is authored in XY and rotated -90deg into the page. Its
    // local +Z is therefore the real surface normal. Using local +Y made the
    // endpoint registration intersect a vertical plane; that happened to sit
    // inside the former 38-unit block but escaped the thicker page envelope.
    new THREE.Vector3(0, 0, 1),
  );
  return entry;
}

function makeWedge(config) {
  config = applyV05Layout(config);
  const width = config.widthMm * xWorldPerMm;
  const length = config.depthMm * zWorldPerMm;
  const root = new THREE.Group();
  root.position.z = zMmToWorld(config.zMm);
  const anchorXWorld = xMmToWorld(config.xMm);
  // The central hall needs two world units of slot allowance so its laminated
  // paper edge clears the page instead of mathematically intersecting it.
  const side = attachToFacingPage(root, anchorXWorld, 2);
  const yawFrame = new THREE.Group();
  const hinge = new THREE.Group();
  const cutout = makePaperCutout(config.texture, width, length, { thickness: config.thickness ?? 5 });
  hinge.add(cutout);
  yawFrame.add(hinge);
  root.add(yawFrame);
  if (!config.concealHardware) addFootHardware(root, width, width * 0.76);

  // Two compact folded braces replace the former full-depth triangular
  // gussets. At rest they fit inside the 38-unit text block; at final they
  // expose a small causal support without piercing the page or the table.
  const braceHeight = Math.min(68, Math.max(42, (config.platformElevationMm ?? 10) * yWorldPerMm));
  const braces = [];
  if (!config.concealHardware) {
    for (const x of [-width * 0.34, width * 0.34]) {
      const brace = new THREE.Group();
      brace.position.x = x;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(12, braceHeight, 4), hingePaper);
      strip.userData.rigHardware = true;
      strip.position.y = braceHeight / 2;
      strip.castShadow = true;
      strip.receiveShadow = true;
      brace.add(strip);
      root.add(brace);
      braces.push(brace);
    }
  }

  const entry = registerMechanism({
    id: config.id,
    role: config.role,
    mechanism: "compound-wedge",
    root,
    side,
    anchorXWorld,
    baseZ: root.position.z,
    targetDeg: config.targetDeg,
    hinges: [hinge, ...braces],
    update(leftDeg) {
      const rise = mechanicalProgress(leftDeg, config.motion);
      const yawDeploy = smooth01(THREE.MathUtils.clamp((rise - 0.68) / 0.32, 0, 1));
      yawFrame.rotation.y = THREE.MathUtils.degToRad((config.yawDeg ?? 0) * yawDeploy);
      hinge.rotation.x = THREE.MathUtils.degToRad(
        THREE.MathUtils.lerp(-90, -(90 - config.targetDeg), rise),
      );
      const braceAngle = THREE.MathUtils.lerp(-90, -22, rise);
      braces.forEach((brace) => {
        brace.rotation.x = THREE.MathUtils.degToRad(braceAngle);
      });
      this.rise = rise;
    },
  });
  if (config.deprojectBbox) {
    const { core, front, back } = cutout.userData.paperLayers;
    queuePhysicalDeprojection(
      entry,
      [core, front, back],
      config.deprojectBbox,
      config.id,
    );
  }
  return entry;
}

function makeObelisk() {
  const plan = depthPieceById.get("obelisk_cross");
  const visual = V05_LAYOUT[plan.id] ?? {};
  if (hybridSpike) {
    const basePrint = textures.get("physical-v05/obelisk/obelisk-base-page-print.png");
    makePageRegisteredDecal({
      id: "obelisk-base-left-page-print",
      texture: cropTexture(basePrint, { x: 0, y: 0, width: 38, height: 454 }, "obelisk-base-left"),
      bbox: [922, 38, 38, 454],
      side: "left",
    });
    makePageRegisteredDecal({
      id: "obelisk-base-right-page-print",
      texture: cropTexture(basePrint, { x: 38, y: 0, width: 49, height: 454 }, "obelisk-base-right"),
      bbox: [960, 38, 49, 454],
      side: "right",
    });
    const leftTrim = textures.get("physical-v05/obelisk/obelisk-front-left-trim.png");
    const rightTrim = textures.get("physical-v05/obelisk/obelisk-front-right-trim.png");
    const leftHalf = makeHingedComponent({
      id: "obelisk_cross_left",
      role: "city.obelisk.cross-slot.left-leaf-half",
      mechanism: "gutter-half-pocket-hinge",
      texture: cropTexture(leftTrim, { x: 0, y: 0, width: 38, height: 358 }, "obelisk-left-half"),
      xMm: -3.2,
      zMm: 99,
      widthMm: 5.8,
      heightMm: 85,
      targetDeg: 89,
      yawDeg: 0,
      thickness: 1.4,
      concealHardware: true,
      hingePocketMm: 1.4,
      deprojectBbox: [922, 38, 38, 358],
      motion: plan.motion,
    });
    const rightHalf = makeHingedComponent({
      id: plan.id,
      role: "city.obelisk.cross-slot.right-leaf-half",
      mechanism: "gutter-half-pocket-hinge",
      texture: cropTexture(rightTrim, { x: 38, y: 0, width: 49, height: 358 }, "obelisk-right-half"),
      xMm: 3.8,
      zMm: 99,
      widthMm: 7.2,
      heightMm: 85,
      targetDeg: 89,
      yawDeg: 0,
      thickness: 1.4,
      concealHardware: true,
      hingePocketMm: 1.4,
      deprojectBbox: [960, 38, 49, 358],
      motion: plan.motion,
    });
    return { leftHalf, rightHalf };
  }
  const width = plan.physicalSizeMm.width * (visual.widthScale ?? 1) * xWorldPerMm;
  const height = plan.physicalSizeMm.height * (visual.heightScale ?? 1) * yWorldPerMm;
  const sideDepth = plan.physicalSizeMm.sideDepth * (visual.sideDepthScale ?? 1) * xWorldPerMm;
  const root = new THREE.Group();
  root.position.z = zMmToWorld(visual.zMm ?? plan.anchor.zMm);
  // A gutter-centred face cannot lie flat without crossing the closed cover.
  // Its folding pivot therefore sits one half-face into the right leaf; the
  // two bridge tabs return visually to the gutter when the spread opens.
  const anchorXWorld = width / 2 + 2 + xMmToWorld(visual.xOffsetMm ?? 0);
  const side = attachToFacingPage(root, anchorXWorld, hybridSpike ? 4 : 0);
  // Fold toward +Z so the 540-unit monument remains inside the closed page
  // depth. Slot hardware is centred on the paper thickness below.
  const foldSign = 1;

  const bridgeWidth = plan.anchor.bridgeWidthMm * xWorldPerMm;
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(anchorXWorld, 5, 72), gutterBridgePaper);
  bridge.position.set(-anchorXWorld / 2, 2.5, 12);
  bridge.castShadow = true;
  bridge.receiveShadow = true;
  root.add(bridge);
  bridge.visible = clayMode || viewMode === "side";
  if (!hybridSpike) addFootHardware(root, anchorXWorld * 1.35, anchorXWorld * 1.1);

  // The other half of the bridge is page-bound to the opposite leaf. The two
  // pieces meet only when the spread reaches its final shallow V.
  const leftBridgeRoot = new THREE.Group();
  leftBridgeRoot.position.z = zMmToWorld(plan.anchor.zMm);
  attachToFacingPage(leftBridgeRoot, -anchorXWorld);
  const leftBridge = new THREE.Mesh(new THREE.BoxGeometry(anchorXWorld, 5, 72), gutterBridgePaper);
  // This root is rotated 180deg with the left page. A positive local centre
  // makes the bridge span from the left anchor back to the gutter.
  leftBridge.position.set(anchorXWorld / 2, 2.5, 12);
  leftBridge.castShadow = true;
  leftBridge.receiveShadow = true;
  leftBridgeRoot.add(leftBridge);
  leftBridge.visible = clayMode || viewMode === "side";

  const crossHinge = new THREE.Group();
  const crossAssembly = new THREE.Group();
  const front = makePaperCutout(componentTexture("obelisk-front-joined"), width, height, {
    thickness: hybridSpike ? 1.4 : 5,
    edgeLayers: 7,
    clayColor: 0xd8ccb7,
  });
  crossAssembly.add(front);

  const sideShape = new THREE.Shape();
  sideShape.moveTo(-sideDepth * 0.62, 0);
  sideShape.lineTo(sideDepth * 0.62, 0);
  sideShape.lineTo(sideDepth * 0.44, height * 0.87);
  sideShape.lineTo(0, height);
  sideShape.lineTo(-sideDepth * 0.44, height * 0.87);
  sideShape.closePath();
  const sideGeometry = new THREE.ExtrudeGeometry(sideShape, {
    depth: hybridSpike ? 1.4 : 4.5,
    bevelEnabled: false,
    curveSegments: 1,
  });
  sideGeometry.translate(0, 0, hybridSpike ? -0.7 : -2.25);
  const obeliskEdgePaper = solidMaterial(clayMode ? 0xb9ad99 : 0x6d6258, { roughness: 0.98 });
  const secondary = new THREE.Mesh(sideGeometry, obeliskEdgePaper);
  secondary.castShadow = true;
  secondary.receiveShadow = true;
  crossAssembly.add(secondary);

  // Visible complementary slot marks explain how the two paper faces pass
  // through one another instead of reading as intersecting CG planes.
  const slotInk = solidMaterial(clayMode ? 0x635649 : 0x4a2e21, { roughness: 1 });
  const frontSlot = new THREE.Mesh(new THREE.BoxGeometry(1.2, height * 0.51, 5.4), slotInk);
  frontSlot.position.set(0, height * 0.255, 0);
  frontSlot.visible = clayMode || viewMode === "side";
  crossAssembly.add(frontSlot);
  const sideSlot = new THREE.Mesh(new THREE.BoxGeometry(4.4, height * 0.49, 6.8), slotInk);
  sideSlot.position.set(0, height * 0.755, 0);
  sideSlot.visible = clayMode || viewMode === "side";
  secondary.add(sideSlot);

  // The collar exposes the cross junction and gives both faces a visible
  // causal footing without resorting to a large backing plate.
  const collarX = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 7, 8), hingePaper);
  collarX.position.set(0, 3.5, 0);
  crossAssembly.add(collarX);
  collarX.visible = clayMode || viewMode === "side";

  const movingRail = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 7, 7), hingePaper);
  movingRail.position.y = 3.5;
  crossHinge.add(movingRail);
  movingRail.visible = clayMode || viewMode === "side";
  crossHinge.add(crossAssembly);
  root.add(crossHinge);

  const entry = registerMechanism({
    id: plan.id,
    role: "city.obelisk.cross-slot",
    mechanism: "cross-slot-gutter-bridge",
    root,
    side,
    anchorXWorld,
    baseZ: root.position.z,
    targetDeg: plan.finalPose.riseFromPageDeg,
    hinges: [crossHinge, secondary],
    update(leftDeg) {
      const rise = mechanicalProgress(leftDeg, plan.motion);
      crossHinge.rotation.x = THREE.MathUtils.degToRad(
        THREE.MathUtils.lerp(
          90 * foldSign,
          (90 - plan.finalPose.riseFromPageDeg) * foldSign,
          rise,
        ),
      );
      // The second face stays inside the same closed slot until the main face
      // is almost upright, then opens into its cross. That removes the former
      // sweep through the page at the intermediate checkpoints.
      const crossDeploy = smooth01(THREE.MathUtils.clamp((rise - 0.72) / 0.28, 0, 1));
      secondary.rotation.y = THREE.MathUtils.degToRad(
        plan.construction.faceAngleDeg * crossDeploy,
      );
      crossAssembly.rotation.y = THREE.MathUtils.degToRad(-9 * crossDeploy);
      this.rise = rise;
    },
  });
  if (hybridSpike) {
    const { core, front: printedFront, back } = front.userData.paperLayers;
    queuePhysicalDeprojection(
      entry,
      [core, printedFront, back],
      [922, 38, 87, 454],
      plan.id,
    );
  }
  return entry;
}

function planCard(id, componentId, role, options = {}) {
  const plan = depthPieceById.get(id);
  return makeHingedComponent({
    id,
    role,
    mechanism: plan.anchor.hinge,
    texture: componentTexture(componentId),
    xMm: plan.anchor.xMm,
    zMm: plan.anchor.zMm,
    widthMm: plan.physicalSizeMm.width,
    heightMm: plan.physicalSizeMm.height,
    targetDeg: plan.finalPose.riseFromPageDeg,
    yawDeg: plan.finalPose.yawDeg,
    railWidthMm: plan.anchor.railWidthMm ?? plan.physicalSizeMm.width,
    concealHardware: hybridSpike,
    thickness: hybridSpike ? 1.8 : undefined,
    hingePocketMm: hybridSpike
      ? (id === "mid_right_dome" ? 3 : id === "mid_right_church" ? 1 : id.startsWith("mid_left") ? 1.5 : 0)
      : 0,
    motion: options.motion ?? plan.motion,
  });
}

// Rear row: each authored wing becomes four narrow architectural pleats. The
// authored party-wall seam remains intact, while each mask half is split once
// more at a quiet vertical bay. This is the minimum closure architecture that
// keeps the tall skyline inside its owning leaf without resizing the print.
if (hybridSpike) {
  const rearSplits = [
    {
      side: "left",
      planId: "rear_skyline_left",
      bbox: [334, 88, 588, 310],
      foldSign: 1,
      regions: [
        ["physical-v05/rear-left/rear-left-outer.png", 0, 167, "outer-west"],
        ["physical-v05/rear-left/rear-left-outer.png", 167, 167, "outer-east"],
        ["physical-v05/rear-left/rear-left-inner.png", 334, 127, "inner-west"],
        ["physical-v05/rear-left/rear-left-inner.png", 461, 127, "inner-east"],
      ],
    },
    {
      side: "right",
      planId: "rear_skyline_right",
      bbox: [1015, 78, 613, 357],
      foldSign: 1,
      regions: [
        ["physical-v05/rear-right/rear-right-inner.png", 0, 172, "inner-west"],
        ["physical-v05/rear-right/rear-right-inner.png", 172, 172, "inner-east"],
        ["physical-v05/rear-right/rear-right-outer.png", 344, 134, "outer-west"],
        ["physical-v05/rear-right/rear-right-outer.png", 478, 135, "outer-east"],
      ],
    },
  ];
  for (const split of rearSplits) {
    const plan = depthPieceById.get(split.planId);
    makeNarrowAccordionLeaves({
      id: split.planId,
      role: `city.buildings.far.${split.side}.four-leaf-accordion`,
      xMm: plan.anchor.xMm,
      zMm: plan.anchor.zMm,
      widthMm: plan.physicalSizeMm.width,
      heightMm: plan.physicalSizeMm.height,
      targetDeg: plan.finalPose.riseFromPageDeg,
      yawDeg: 0,
      foldSign: split.foldSign,
      thickness: 1.8,
      hingePocketMm: 3.5,
      leaves: split.regions.map(([file, sourceX, pixelWidth, label], index) => ({
        id: index === 0 ? split.planId : `${split.planId}_leaf_${index + 1}`,
        texture: cropTexture(
          textures.get(file),
          { x: sourceX, y: 0, width: pixelWidth, height: split.bbox[3] },
          `${split.planId}-${label}`,
        ),
        bbox: [split.bbox[0] + sourceX, split.bbox[1], pixelWidth, split.bbox[3]],
      })),
      motion: plan.motion,
    });
  }
} else {
  for (const id of ["rear_skyline_left", "rear_skyline_right"]) {
    const plan = depthPieceById.get(id);
    makeHingedComponent({
      id,
      role: `city.buildings.far.${id.endsWith("left") ? "left" : "right"}`,
      mechanism: "v-fold-skyline-wing",
      texture: textures.get(plan.source),
      xMm: plan.anchor.xMm,
      zMm: plan.anchor.zMm,
      widthMm: plan.physicalSizeMm.width,
      heightMm: plan.physicalSizeMm.height,
      targetDeg: plan.finalPose.riseFromPageDeg,
      yawDeg: plan.finalPose.yawDeg,
      railWidthMm: plan.anchor.railWidthMm,
      motion: plan.motion,
    });
  }
}

let midLeftContinuity = null;
if (hybridSpike) {
  const midLeftSource = textures.get("city/city-buildings-mid-left--left.png");
  let midLeftShadow = knockoutTexture(
    midLeftSource,
    { x: 0, y: 0, width: 237, height: 830 },
    "mid-left-shadow-minus-clock",
  );
  midLeftShadow = knockoutTexture(
    midLeftShadow,
    { x: 182, y: 70, width: 258, height: 641 },
    "mid-left-shadow-minus-hall",
  );
  midLeftShadow = knockoutTexture(
    midLeftShadow,
    { x: 411, y: 130, width: 173, height: 460 },
    "mid-left-shadow-minus-tower",
  );
  makePageRegisteredDecal({
    id: "mid-left-continuity-shadow-print",
    texture: midLeftShadow,
    bbox: [306, 98, 584, 830],
    side: "left",
    color: 0xd6d2cc,
  });
  // Dome, terminal and church are an alpha-disjoint, pixel-exact partition of
  // the full mid-right source.  The former OKLab underprint was therefore a
  // second recognizable city copy; removing it eliminates the dark seam and
  // prevents ghost architecture during deployment.
}

// The spike keeps only the palace and terminal as hero lifts. Omitted cards
// are not constructed in hybrid mode: invisible geometry must not alter
// swept envelopes, closure, or QA counts.
const midRightDome = planCard(
  "mid_right_dome",
  "mid-right-dome",
  "city.buildings.mid.right.dome",
  // The closed dome and the rear-right accordion share a swept pocket. The
  // dome clears that pocket first, then the rear row begins at 55 degrees.
  // Both remain driven exclusively by the conserved book-opening angle.
  { motion: { openStartDeg: 18, openFinishDeg: 52 } },
);
const midRightTerminal = planCard(
  "mid_right_terminal",
  "mid-right-terminal",
  "city.buildings.mid.right.terminal",
  // The rear-right pleats clear the terminal footprint by 120 degrees. The
  // terminal then rises from that same left-page angle: a causal paper stagger,
  // never an independent delay clock.
  { motion: { openStartDeg: 122, openFinishDeg: 166 } },
);
const midRightChurchPlan = depthPieceById.get("mid_right_church");
const midRightChurchTexture = componentTexture("mid-right-church");
const midRightChurch = hybridSpike
  ? makeNarrowAccordionLeaves({
    id: "mid_right_church",
    role: "city.buildings.mid.right.church-three-leaf-accordion",
    xMm: 129.4,
    zMm: 57,
    widthMm: midRightChurchPlan.physicalSizeMm.width,
    heightMm: midRightChurchPlan.physicalSizeMm.height,
    targetDeg: 86,
    yawDeg: -6,
    foldSign: -1,
    thickness: 1.8,
    hingePocketMm: 2,
    leaves: [69, 68, 68].map((pixelWidth, index) => {
      const sourceX = index === 0 ? 0 : index === 1 ? 69 : 137;
      return {
        id: index === 0 ? "mid_right_church" : `mid_right_church_leaf_${index + 1}`,
        texture: cropTexture(
          midRightChurchTexture,
          { x: sourceX, y: 0, width: pixelWidth, height: 584 },
          `mid-right-church-leaf-${index + 1}`,
        ),
        bbox: [1497 + sourceX, 88, pixelWidth, 584],
      };
    }),
    motion: midRightChurchPlan.motion,
  })
  : planCard("mid_right_church", "mid-right-church", "city.buildings.mid.right.church");
const midLeftClock = planCard("mid_left_clock_door", "mid-left-clock-red-door", "city.buildings.mid.left.clock-door");
const midLeftTower = planCard("mid_left_right_tower", "mid-left-right-tower", "city.buildings.mid.left.right-tower");

const hallPlan = depthPieceById.get("mid_left_hall_wedge");
makeWedge({
  id: hallPlan.id,
  role: "city.buildings.mid.left.central-hall-wedge",
  texture: componentTexture("mid-left-central-hall"),
  xMm: hallPlan.anchor.xMm,
  zMm: hallPlan.anchor.zMm,
  widthMm: hallPlan.physicalSizeMm.width,
  depthMm: hallPlan.physicalSizeMm.depth,
  targetDeg: hallPlan.finalPose.riseFromPageDeg,
  yawDeg: hallPlan.finalPose.yawDeg,
  platformElevationMm: hallPlan.finalPose.platformElevationMm,
  thickness: hybridSpike ? 1.8 : undefined,
  concealHardware: hybridSpike,
  motion: hallPlan.motion,
});

const leftDeckPlan = depthPieceById.get("front_deck_left");
const nearLeftDeckTexture = componentTexture("near-left-deck-base");
let leftDeck = null;
if (hybridSpike) {
  const frontLeftGround = textures.get("physical-v05/front-left/front-left-page-ground-print.png");
  const frontLeftFascia = textures.get("physical-v05/front-left/front-left-retiro-train-fascia.png");
  const frontLeftStairs = textures.get("physical-v05/front-left/front-left-stair-wing.png");
  const frontLeftMicrodeck = textures.get("physical-v05/front-left/front-left-microdeck-top.png");
  makePageRegisteredDecal({
    id: "near-left-ground-print",
    texture: frontLeftGround,
    bbox: [162, 502, 798, 475],
    side: "left",
  });
  makePageRegisteredDecal({
    id: "near-left-ground-residual-print",
    texture: textures.get("physical-v05/front-left/front-left-page-ground-residual.png"),
    bbox: [162, 502, 798, 475],
    side: "left",
  });
  leftDeck = makeHingedComponent({
    id: leftDeckPlan.id,
    role: "city.buildings.near.left.retiro-upper-fascia",
    mechanism: "platform-front-fascia-fold",
    texture: cropTexture(
      frontLeftFascia,
      { x: 188, y: 192, width: 473, height: 145 },
      "retiro-upper-fascia",
    ),
    xMm: -70,
    // The upper fascia occupies the closest front-left corridor. Hero
    // deprojection keeps the PSD registration unchanged while a slight
    // camera-facing lean carries the sign in front of the clock card.
    zMm: 4,
    widthMm: 78,
    heightMm: 32,
    targetDeg: 118,
    yawDeg: 0,
    thickness: 1.4,
    // Deep page-side pocket keeps the forward-leaning fascia above the left
    // leaf throughout deployment; the pocket remains hidden by the 6 mm deck.
    hingePocketMm: 5.2,
    concealHardware: true,
    // Canonical PSD registration for the alpha-tight upper RETIRO fascia.
    // Keep this local to the physical split as well as in V05_LAYOUT so the
    // component cannot silently fall back to its provisional card dimensions.
    deprojectBbox: [350, 694, 473, 145],
    motion: leftDeckPlan.motion,
  });
  makeNarrowAccordionLeaves({
    id: "front-left-train-fascia",
    role: "city.buildings.near.left.train-lower-fascia-three-leaf",
    xMm: -70,
    zMm: 10,
    widthMm: 78,
    heightMm: 24,
    targetDeg: 78,
    yawDeg: 0,
    foldSign: -1,
    thickness: 1.4,
    hingePocketMm: 2,
    leaves: [158, 158, 157].map((pixelWidth, index) => {
      const sourceX = index === 0 ? 188 : index === 1 ? 346 : 504;
      return {
        id: index === 0 ? "front-left-train-fascia" : `front-left-train-fascia-leaf-${index + 1}`,
        texture: cropTexture(
          frontLeftFascia,
          { x: sourceX, y: 337, width: pixelWidth, height: 108 },
          `retiro-train-lower-fascia-${index + 1}`,
        ),
        bbox: [162 + sourceX, 839, pixelWidth, 108],
      };
    }),
    motion: leftDeckPlan.motion,
  });
  const westPocketLeaves = [
    { sourceX: 7, sourceY: 7, pixelWidth: 101, pixelHeight: 453 },
    { sourceX: 108, sourceY: 12, pixelWidth: 106, pixelHeight: 447 },
  ];
  makeVerticalAccordionPair({
    id: "front-left-stair-west",
    role: "city.buildings.near.left.west-wing-pocket-seam-pair",
    mechanism: "page-pocket-plus-authored-vertical-seam",
    xMm: -115,
    zMm: 20,
    widthMm: 38,
    heightMm: 78,
    targetDeg: 58,
    yawDeg: 0,
    foldSign: -1,
    seamFoldSign: -1,
    thickness: 1.4,
    hingePocketMm: 3,
    // The thicker textblock needs a slightly deeper return so the concealed
    // linkage retains the same >=6mm trim inset while the open artwork remains
    // registered to the PSD.
    pocketDepthMm: 13,
    pocketWidthMm: 24,
    pocketFinishDeg: 108,
    overallBbox: [169, 509, 207, 453],
    leaves: westPocketLeaves.map(({ sourceX, sourceY, pixelWidth, pixelHeight }, index) => ({
      id: index === 0 ? "front-left-stair-west" : "front-left-stair-west-leaf-2",
      texture: cropTexture(
        frontLeftStairs,
        { x: sourceX, y: sourceY, width: pixelWidth, height: pixelHeight },
        `front-left-west-wing-pocket-${index + 1}`,
      ),
      bbox: [162 + sourceX, 502 + sourceY, pixelWidth, pixelHeight],
    })),
    // One conserved page-angle driver: the pocket clears first, then the
    // connected facade pair deploys. There is no independent time clock.
    motion: { openStartDeg: 50, openFinishDeg: 108 },
    faceMotion: { openStartDeg: 108, openFinishDeg: 153 },
  });
  makeNarrowAccordionLeaves({
    id: "front-left-stair-east",
    role: "city.buildings.near.left.east-stair-three-leaf-v-fold",
    xMm: -25,
    zMm: 18,
    widthMm: 48,
    heightMm: 64,
    targetDeg: 58,
    yawDeg: 0,
    foldSign: -1,
    thickness: 1.4,
    hingePocketMm: 3,
    // A short page-side return absorbs the extra textblock height during the
    // closed pose. Each narrow leaf still resolves to its original PSD bbox.
    pocketDepthMm: 13,
    pocketFinishDeg: 108,
    pocketWidthMm: 4,
    pocketInsetMm: 0,
    leaves: [100, 99, 99].map((pixelWidth, index) => {
      const sourceX = index === 0 ? 500 : index === 1 ? 600 : 699;
      return {
        id: index === 0 ? "front-left-stair-east" : `front-left-stair-east-leaf-${index + 1}`,
        texture: cropTexture(
          frontLeftStairs,
          { x: sourceX, y: 105, width: pixelWidth, height: 370 },
          `front-left-east-stair-${index + 1}`,
        ),
        bbox: [162 + sourceX, 607, pixelWidth, 370],
      };
    }),
    motion: { openStartDeg: 50, openFinishDeg: 108 },
    faceMotion: { openStartDeg: 108, openFinishDeg: 153 },
  });
  // This narrow surface is the printed top of the Retiro deck, not an
  // independent pop-up wall. Keeping it bonded to the page preserves the PSD
  // overlap while the two real fascia folds supply the foreground depth.
  makePageRegisteredDecal({
    id: "front-left-microdeck-top-print",
    texture: cropTexture(
      frontLeftMicrodeck,
      { x: 188, y: 276, width: 478, height: 61 },
      "front-left-microdeck-top",
    ),
    bbox: [350, 778, 478, 61],
    side: "left",
  });
} else {
  leftDeck = makeDeck({
    id: leftDeckPlan.id,
    role: "city.buildings.near.left.deck",
    texture: nearLeftDeckTexture,
    xMm: leftDeckPlan.anchor.xMm,
    zMm: leftDeckPlan.anchor.zMm,
    widthMm: leftDeckPlan.physicalSizeMm.width,
    depthMm: leftDeckPlan.physicalSizeMm.depth,
    elevationMm: leftDeckPlan.finalPose.platformElevationMm,
    targetDeg: leftDeckPlan.finalPose.riseFromPageDeg,
    yawDeg: leftDeckPlan.finalPose.yawDeg,
    motion: leftDeckPlan.motion,
  });
}
const leftWestGate = hybridSpike ? null : makeHingedComponent({
  id: "near-left-west-gate",
  role: "city.buildings.near.left.west-gate",
  mechanism: "deck-mounted-relief-card",
  texture: componentTexture("near-left-west-gate"),
  xMm: -132,
  zMm: 10,
  widthMm: 42,
  heightMm: 68,
  targetDeg: 58,
  yawDeg: 7,
  motion: { openStartDeg: 50, openFinishDeg: 153 },
  parentContext: leftDeck.topContext,
});

const rightDeckPlan = depthPieceById.get("front_deck_right");
let rightDeck = null;
let rightBackFacades = null;
if (hybridSpike) {
  const rightFacadeTexture = componentTexture("near-right-back-facades");
  rightBackFacades = makeNarrowAccordionLeaves({
    id: "near-right-back-facades",
    role: "city.buildings.near.right.back-facades-three-leaf",
    xMm: 70.5,
    zMm: 43,
    widthMm: 139,
    heightMm: 40,
    targetDeg: 61,
    yawDeg: -5,
    foldSign: -1,
    thickness: 1.8,
    hingePocketMm: 3,
    leaves: [241, 241, 240].map((pixelWidth, index) => {
      const sourceX = index * 241;
      return {
        id: index === 0 ? "near-right-back-facades" : `near-right-back-facades-leaf-${index + 1}`,
        texture: cropTexture(
          rightFacadeTexture,
          { x: sourceX, y: 0, width: pixelWidth, height: 206 },
          `near-right-back-facades-${index + 1}`,
        ),
        bbox: [960 + sourceX, 502, pixelWidth, 206],
      };
    }),
    motion: { openStartDeg: 54, openFinishDeg: 158 },
  });
} else {
  rightDeck = makeDeck({
    id: rightDeckPlan.id,
    role: "city.buildings.near.right.deck",
    texture: componentTexture("near-right-deck-base"),
    xMm: rightDeckPlan.anchor.xMm,
    zMm: rightDeckPlan.anchor.zMm,
    widthMm: rightDeckPlan.physicalSizeMm.width,
    depthMm: rightDeckPlan.physicalSizeMm.depth,
    elevationMm: rightDeckPlan.finalPose.platformElevationMm,
    targetDeg: rightDeckPlan.finalPose.riseFromPageDeg,
    yawDeg: rightDeckPlan.finalPose.yawDeg,
    motion: rightDeckPlan.motion,
  });
  rightBackFacades = makeHingedComponent({
    id: "near-right-back-facades",
    role: "city.buildings.near.right.back-facades",
    mechanism: "deck-mounted-shallow-v-fold",
    texture: componentTexture("near-right-back-facades"),
    xMm: 69,
    zMm: 36,
    widthMm: 139,
    heightMm: 40,
    targetDeg: 61,
    yawDeg: -5,
    motion: { openStartDeg: 54, openFinishDeg: 158 },
    parentContext: rightDeck.topContext,
  });
}
const rightClockTower = makeHingedComponent({
  id: "near-right-clock-tower",
  role: "city.buildings.near.right.clock-tower",
  mechanism: hybridSpike
    ? "page-bound-inclined-relief-card-with-foot-tab"
    : "deck-mounted-relief-card",
  texture: componentTexture("near-right-clock-tower"),
  xMm: 148,
  zMm: 20,
  widthMm: 22,
  heightMm: 67,
  targetDeg: 66,
  yawDeg: -9,
  thickness: hybridSpike ? 1.8 : undefined,
  hingePocketMm: hybridSpike ? 3 : 0,
  concealHardware: hybridSpike,
  motion: hybridSpike
    ? { openStartDeg: 118, openFinishDeg: 166 }
    : { openStartDeg: 58, openFinishDeg: 160 },
  parentContext: hybridSpike ? undefined : rightDeck.topContext,
});

makeObelisk();

const peopleParentByKey = new Map(
  assetMap.city
    .filter((item) => item.role.includes("people"))
    .map((item) => [`${item.role}:${item.side}`, item]),
);

const liftedPeople = new Set([
  "far-left-03",
  "far-left-04",
  "far-right-03",
  "near-left-04",
  "near-left-05",
  "near-left-06",
  "near-left-08",
]);

// Most distant figures are ink on the street plane. This recovers the exact
// authored population and removes the row of visible CG foot blocks. A later
// review may promote only a few of these IDs into shallow physical standees.
for (const standee of standeeManifest.pieces.filter((item) => item.family === "far")) {
  const parent = peopleParentByKey.get(`city.people.far:${standee.side}`);
  const [x0, y0, x1, y1] = standee.sourceCrop;
  makePageRegisteredDecal({
    id: `${standee.id}-page-print`,
    texture: textures.get(standee.file),
    bbox: [parent.x + x0, parent.y + y0, x1 - x0, y1 - y0],
    side: standee.side,
  });
}

for (const standee of standeeManifest.pieces.filter((item) => item.family === "near")) {
  const parent = peopleParentByKey.get(`city.people.near:${standee.side}`);
  const [x0, y0, x1, y1] = standee.sourceCrop;
  makePageRegisteredDecal({
    id: `${standee.id}-page-print`,
    texture: textures.get(standee.file),
    bbox: [parent.x + x0, parent.y + y0, x1 - x0, y1 - y0],
    side: standee.side,
    clipToSurface: standee.side === "left" && ["near-left-01", "near-left-02", "near-left-03"].includes(standee.id),
  });
}

if (hybridSpike) {
  // The full Riachuelo residual is registered as ink on the page: water never
  // becomes a raised slab. The facade row remains the first physical lift;
  // lab, pier, boat and rail masks are promoted in the next refinement.
  makePageRegisteredDecal({
    id: "near-right-ground-print",
    texture: componentTexture("near-right-deck-base"),
    bbox: [960, 669, 836, 308],
    side: "right",
  });
}

// All cutouts remain mechanically instantiated for the v0.4 closure audit,
// but far people are withheld from the hero until their 3–5 relief subset is
// explicitly selected. Near figures keep their small paper silhouettes.
standeeManifest.pieces.forEach((standee, index) => {
  if (hybridSpike && !liftedPeople.has(standee.id)) return;
  const xMm = (standee.sourceGlobalCenterX - assetMap.gutter.x) * 0.1923077;
  const near = standee.family === "near";
  const entry = makeHingedComponent({
    id: standee.id,
    role: `city.people.${standee.family}.${standee.id}`,
    mechanism: "individual-foot-tab-standee",
    texture: textures.get(standee.file),
    xMm,
    zMm: standee.anchor.zMm,
    widthMm: standee.physicalSizeMm.width,
    heightMm: standee.physicalSizeMm.height,
    targetDeg: standee.finalPose.riseFromPageDeg,
    yawDeg: standee.finalPose.yawDeg,
    railWidthMm: Math.max(2.4, standee.physicalSizeMm.width * 0.72),
    thickness: 2.8,
    edgeLayers: 3,
    concealHardware: true,
    motion: {
      openStartDeg: (near ? 82 : 76) + (index % 4) * 1.8,
      openFinishDeg: 164 + (index % 3),
    },
  });
});

// The small right-side near figure is already a single narrow connected card,
// unlike the forbidden grouped parent people sheets.
const rightNearPerson = assetMap.city.find(
  (item) => item.role === "city.people.near" && item.side === "right",
);
if (rightNearPerson && !hybridSpike) {
  const rightNearStandee = makeHingedComponent({
    id: "near-right-single-standee",
    role: "city.people.near.right-single",
    mechanism: "individual-foot-tab-standee",
    texture: textures.get(rightNearPerson.file),
    xMm: 8,
    zMm: 18,
    widthMm: 6.5,
    heightMm: 22,
    targetDeg: 86,
    yawDeg: -11,
    railWidthMm: 4,
    thickness: 2.8,
    edgeLayers: 3,
    concealHardware: true,
    motion: { openStartDeg: 86, openFinishDeg: 166 },
  });
}

const taxiMeta = assetMap.taxi;
const taxi = makePageRegisteredDecal({
  id: "taxi-page-print",
  texture: textures.get(taxiMeta.file),
  bbox: [taxiMeta.x, taxiMeta.y, taxiMeta.width, taxiMeta.height],
  side: taxiMeta.x + taxiMeta.width / 2 < assetMap.gutter.x ? "left" : "right",
});

function registerPageHingeToTargetBottom(entry, bbox, hingeZInsetMm = 0) {
  const page = entry.root.parent;
  if (page !== leftTextblock && page !== rightTextblock) return;
  page.updateWorldMatrix(true, false);
  heroCamera.updateMatrixWorld(true);
  const pageMatrix = page.matrixWorld;
  const planePoint = new THREE.Vector3(0, entry.root.position.y, 0).applyMatrix4(pageMatrix);
  const planeNormal = new THREE.Vector3(0, 1, 0)
    .applyMatrix3(new THREE.Matrix3().getNormalMatrix(pageMatrix))
    .normalize();
  const pagePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, planePoint);
  const [x, y, width, height] = bbox;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(
    new THREE.Vector2(
      (x + width / 2) / WIDTH * 2 - 1,
      1 - (y + height) / HEIGHT * 2,
    ),
    heroCamera,
  );
  const hingeWorld = raycaster.ray.intersectPlane(pagePlane, new THREE.Vector3());
  if (!hingeWorld) throw new Error(`Cannot register hinge for ${entry.id}`);
  const hingeLocal = hingeWorld.applyMatrix4(pageMatrix.clone().invert());
  entry.root.position.x = hingeLocal.x;
  entry.root.position.z = hingeLocal.z - hingeZInsetMm * zWorldPerMm;
  entry.anchorXWorld = entry.side === "left" ? -hingeLocal.x : hingeLocal.x;
  entry.baseZ = hingeLocal.z;
  entry.root.updateWorldMatrix(true, true);
}

function applyPhysicalDeprojectionQueue() {
  if (physicalDeprojectionQueue.length === 0) return;
  const previousLeft = leftTextblock.rotation.z;
  const previousRight = rightTextblock.rotation.z;
  leftTextblock.rotation.z = THREE.MathUtils.degToRad(177.5);
  rightTextblock.rotation.z = THREE.MathUtils.degToRad(2.5);
  for (const mechanism of cityPanels) mechanism.update(177.5);
  scene.updateMatrixWorld(true);

  const registeredEntries = new Set();
  for (const target of physicalDeprojectionQueue) {
    if (Math.abs(target.localNormal.z) > 0.5 && !registeredEntries.has(target.entry)) {
      registerPageHingeToTargetBottom(
        target.entry,
        target.hingeBbox ?? target.bbox,
        target.hingeZInsetMm,
      );
      registeredEntries.add(target.entry);
      scene.updateMatrixWorld(true);
    }
    if (target.beforeGeometry) {
      target.beforeGeometry();
      scene.updateMatrixWorld(true);
    }
    const reference = target.meshes.find((mesh) => mesh.userData.paperLayer === "front")
      ?? target.meshes[0];
    const deprojected = screenRegisteredGeometryOnMesh(
      reference,
      target.bbox,
      target.subdivisions,
      target.localNormal,
    );
    target.meshes.forEach((mesh, index) => {
      mesh.geometry = index === 0 ? deprojected : deprojected.clone();
      mesh.userData.deprojected = true;
      mesh.userData.deprojectionId = target.id;
      mesh.userData.targetBbox = target.bbox;
    });
  }

  leftTextblock.rotation.z = previousLeft;
  rightTextblock.rotation.z = previousRight;
  for (const mechanism of cityPanels) mechanism.update(0);
  scene.updateMatrixWorld(true);
}

applyPhysicalDeprojectionQueue();

hooks.__rigParts = {
  bookRoot,
  fixedSpineCasing,
  movingSpineCasing,
  coverHinge,
  coverBoard,
  leftTextblock,
  leftBody,
  rightTextblock,
  rightBody,
  cityPanels,
  pageDecals,
  floor,
  heroCamera,
  sideCamera,
};

/* VISUAL_CALIBRATION_HOOK_START */
// v0.5 may tune rendering, light and material response, but it must not own or
// mutate any transform, hinge, pose or animation curve. The mechanics lock
// verifier removes exactly this block before checking the original v0.4 hash.
hooks.__visualCalibrationTargets = {
  THREE,
  renderer,
  scene,
  bookRoot,
  cityPanels,
  warmAmbient,
  keyLight,
  rimLight,
  coreMaterials: { pagePaper, pageEdge, leather, hingePaper },
  render: renderFrame,
};
/* VISUAL_CALIBRATION_HOOK_END */

function renderFrame() {
  renderer.clear(true, true, true);
  if (viewMode === "hero" && !runtimeMode) renderer.render(backgroundScene, screenCamera);
  renderer.clearDepth();
  renderer.render(scene, camera);
  if (viewMode === "hero" && !clayMode && !runtimeMode) {
    renderer.clearDepth();
    renderer.render(overlayScene, screenCamera);
  }
}

function pageLocalYRange(root, pageGroup) {
  const inversePage = pageGroup.matrixWorld.clone().invert();
  const point = new THREE.Vector3();
  let min = Infinity;
  let max = -Infinity;
  root.traverse((object) => {
    if (!object.isMesh) return;
    const position = object.geometry?.getAttribute("position");
    if (!position) return;
    const toPage = inversePage.clone().multiply(object.matrixWorld);
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(toPage);
      min = Math.min(min, point.y);
      max = Math.max(max, point.y);
    }
  });
  return { min, max };
}

function projectWorldBoxToScreen(box) {
  const points = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        points.push(new THREE.Vector3(x, y, z).project(camera));
      }
    }
  }
  const xs = points.map((point) => (point.x * 0.5 + 0.5) * WIDTH);
  const ys = points.map((point) => (-point.y * 0.5 + 0.5) * HEIGHT);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return {
    x: Number(left.toFixed(2)),
    y: Number(top.toFixed(2)),
    width: Number((right - left).toFixed(2)),
    height: Number((bottom - top).toFixed(2)),
    center: [Number(((left + right) / 2).toFixed(2)), Number(((top + bottom) / 2).toFixed(2))],
  };
}

function projectWorldPointToScreen(point) {
  const projected = point.clone().project(camera);
  return [
    Number(((projected.x * 0.5 + 0.5) * WIDTH).toFixed(2)),
    Number(((-projected.y * 0.5 + 0.5) * HEIGHT).toFixed(2)),
  ];
}

function projectMeshVerticesToScreen(meshes) {
  const point = new THREE.Vector3();
  const xs = [];
  const ys = [];
  for (const mesh of meshes) {
    const position = mesh.geometry?.getAttribute("position");
    if (!position) continue;
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld).project(camera);
      xs.push((point.x * 0.5 + 0.5) * WIDTH);
      ys.push((-point.y * 0.5 + 0.5) * HEIGHT);
    }
  }
  if (xs.length === 0) return null;
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return {
    x: Number(left.toFixed(2)),
    y: Number(top.toFixed(2)),
    width: Number((right - left).toFixed(2)),
    height: Number((bottom - top).toFixed(2)),
    center: [Number(((left + right) / 2).toFixed(2)), Number(((top + bottom) / 2).toFixed(2))],
  };
}

function updateRig(timeMs, collectDiagnostics = true) {
  const clampedTime = THREE.MathUtils.clamp(timeMs, 0, ACTION_DURATION_MS);
  const coverDeg = sampleKeyframes(clampedTime, poses.poses, "coverDeg");
  const leftDeg = sampleKeyframes(clampedTime, poses.poses, "leftTextblockDeg");
  // The paper city has no independent animation clock. Its deployment is a
  // mechanical consequence of the conserved left text block crossing 70deg.
  // The authored cityGlobal curve remains in rig-poses only as a diagnostic
  // reference; it can never move a piece on its own.
  const authoredCityGlobal = sampleKeyframes(clampedTime, poses.poses, "cityGlobal");
  // Blend the authored PSD priority only after the cards are mostly deployed.
  // During the mechanical opening their untouched physical depth remains the
  // sole authority; the last approach to the approved endpoint resolves the
  // few layer crossings exactly as Photoshop painted them.
  const psdOrderMix = psdOrderMode
    ? smooth01(THREE.MathUtils.clamp((leftDeg - 150) / 27.5, 0, 1))
    : 0;
  for (const entry of psdOrderedMaterials) {
    // 0.000095 is the measured worst-case adjacent-layer separation at the
    // approved hero camera (alpha-aware 5 px audit, plus a small guard band).
    // Using the measured bound keeps the correction minimal and deterministic.
    entry.uniform.value = Math.max(0, entry.order - 6) * 0.000095 * psdOrderMix;
  }
  const cityGlobal = smooth01(
    THREE.MathUtils.clamp((leftDeg - 70) / (177.5 - 70), 0, 1),
  );

  coverHinge.rotation.z = THREE.MathUtils.degToRad(coverDeg);
  leftTextblock.rotation.z = THREE.MathUtils.degToRad(leftDeg);
  rightTextblock.rotation.z = THREE.MathUtils.degToRad(2.5 * smooth01(leftDeg / 177.5));

  // The printed spread and the final left-facing page are physically buried
  // between the conserved text blocks while the book is closed.  Their
  // endpoint-deprojected geometry extends beyond the far cover edge in camera
  // space, so letting it render before the hinge creates skyline wires and a
  // gold paper wedge through an otherwise opaque cover.  Expose the inner
  // surfaces only after the left block has created a real opening; at this
  // angle the cover still occludes the visibility switch.
  const innerPagesExposed = leftDeg >= INNER_PAGE_EXPOSURE_DEG;
  leftFinalPage.visible = innerPagesExposed;
  rightTop.visible = innerPagesExposed;
  // This is an interior gutter sheet, not the outside spine. Keeping it
  // visible in the closed pose projected it beyond the cover as a translucent
  // vertical shard. It is revealed only after the page block has opened a
  // real gap; at this threshold the moving cover still hides the switch.
  gutterTop.visible = innerPagesExposed;
  for (const cap of exteriorSpineEndCaps) cap.visible = !innerPagesExposed;
  leftClosedEdgeSkin.visible = !innerPagesExposed;
  rightClosedEdgeSkin.visible = !innerPagesExposed;
  for (const { mesh } of pageDecals) mesh.visible = innerPagesExposed;

  for (const mechanism of cityPanels) {
    mechanism.update(leftDeg);
    mechanism.root.visible = innerPagesExposed
      && (isolateIds.size === 0 || isolateIds.has(mechanism.id));
  }

  renderFrame();
  hooks.__rigState = {
    timeMs: clampedTime,
    coverDeg,
    leftTextblockDeg: leftDeg,
    cityGlobal,
    authoredCityGlobal,
    mode: clayMode ? "clay" : "normal",
    view: viewMode,
  };
  // Interactive motion does not need to rebuild every QA envelope on every
  // paint. Skipping those allocations while GSAP advances the playhead makes
  // the physical opening perceptually continuous; the final frame and all
  // explicit review calls still collect the full diagnostics.
  if (!collectDiagnostics) return;
  scene.updateMatrixWorld(true);
  const panelBases = cityPanels.map((mechanism) => {
    const baseWorld = mechanism.root.getWorldPosition(new THREE.Vector3());
    const bounds = new THREE.Box3().setFromObject(mechanism.root);
    const printBounds = new THREE.Box3();
    const printMeshes = [];
    mechanism.root.traverse((object) => {
      if (object.isMesh && object.userData.printFront) {
        printBounds.expandByObject(object);
        printMeshes.push(object);
      }
    });
    const pageGroup = mechanism.side === "left" ? leftTextblock : rightTextblock;
    const inversePage = pageGroup.matrixWorld.clone().invert();
    const pageLocalBounds = bounds.clone().applyMatrix4(inversePage);
    const pageY = pageLocalYRange(mechanism.root, pageGroup);
    const pageLocal = mechanism.side === "left"
      ? new THREE.Vector3(-mechanism.anchorXWorld, -0.7, mechanism.baseZ)
      : new THREE.Vector3(mechanism.anchorXWorld, PAGE_THICKNESS + 0.7, mechanism.baseZ);
    const pageWorld = (mechanism.side === "left" ? leftTextblock : rightTextblock).localToWorld(pageLocal);
    return {
      id: mechanism.id,
      role: mechanism.role,
      side: mechanism.side,
      mechanism: mechanism.mechanism,
      targetDeg: mechanism.targetDeg,
      rise: Number((mechanism.rise ?? 0).toFixed(3)),
      base: baseWorld.toArray().map((value) => Number(value.toFixed(2))),
      baseScreen: projectWorldPointToScreen(baseWorld),
      page: pageWorld.toArray().map((value) => Number(value.toFixed(2))),
      clearanceY: Number((baseWorld.y - pageWorld.y).toFixed(2)),
      bounds: {
        min: bounds.min.toArray().map((value) => Number(value.toFixed(2))),
        max: bounds.max.toArray().map((value) => Number(value.toFixed(2))),
      },
      projected: projectWorldBoxToScreen(bounds),
      printProjected: projectMeshVerticesToScreen(printMeshes),
      pageLocalBounds: {
        min: pageLocalBounds.min.toArray().map((value) => Number(value.toFixed(2))),
        max: pageLocalBounds.max.toArray().map((value) => Number(value.toFixed(2))),
      },
      pageLocalY: {
        min: Number(pageY.min.toFixed(2)),
        max: Number(pageY.max.toFixed(2)),
      },
      underPage: mechanism.side === "left"
        ? pageY.max > 5
        : pageY.min < PAGE_THICKNESS - 3.8,
    };
  });
  const cityBounds = new THREE.Box3();
  for (const mechanism of cityPanels) cityBounds.expandByObject(mechanism.root);
  const decalDiagnostics = pageDecals.map(({ id, mesh, bbox, side }) => {
    const bounds = new THREE.Box3().setFromObject(mesh);
    return {
      id,
      side,
      sourceBbox: bbox,
      projected: projectMeshVerticesToScreen([mesh]),
      worldAabbProjected: projectWorldBoxToScreen(bounds),
    };
  });
  const closedBookBounds = new THREE.Box3();
  for (const object of [
    leftBody,
    rightBody,
    coverBoard,
    spine,
    fixedSpineCasing,
    movingSpineCasing,
  ]) closedBookBounds.expandByObject(object);
  hooks.__rigDiagnostics = {
    camera: {
      fov: camera.fov,
      position: camera.position.toArray(),
    },
    spread: {
      leftDeg,
      rightDeg: THREE.MathUtils.radToDeg(rightTextblock.rotation.z),
    },
    panelBases,
    pageDecals: decalDiagnostics,
    envelopes: {
      city: {
        min: cityBounds.min.toArray().map((value) => Number(value.toFixed(2))),
        max: cityBounds.max.toArray().map((value) => Number(value.toFixed(2))),
      },
      bookMass: {
        min: closedBookBounds.min.toArray().map((value) => Number(value.toFixed(2))),
        max: closedBookBounds.max.toArray().map((value) => Number(value.toFixed(2))),
        projected: projectWorldBoxToScreen(closedBookBounds),
      },
      underPageCount: panelBases.filter((item) => item.underPage).length,
    },
    depthSpan: {
      min: Math.min(...cityPanels.map(({ baseZ }) => baseZ)),
      max: Math.max(...cityPanels.map(({ baseZ }) => baseZ)),
    },
  };
}

let animationFrame = 0;
let playing = false;
let playStart = 0;
let playFrom = 0;
let playDurationMs = 0;

function easePower2InOut(progress) {
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - ((-2 * progress + 2) ** 2) / 2;
}

function stop() {
  playing = false;
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
}

function tick(now) {
  if (!playing) return;
  const progress = THREE.MathUtils.clamp((now - playStart) / Math.max(1, playDurationMs), 0, 1);
  const timeMs = playFrom + easePower2InOut(progress) * (ACTION_DURATION_MS - playFrom);
  updateRig(timeMs, false);
  if (progress >= 1) {
    stop();
    updateRig(ACTION_DURATION_MS);
    return;
  }
  animationFrame = requestAnimationFrame(tick);
}

function play(fromMs = hooks.__rigState?.timeMs ?? 0) {
  stop();
  resetPopupMotion(true);
  playFrom = fromMs >= ACTION_DURATION_MS ? 0 : fromMs;
  const remaining = Math.max(0, 1 - playFrom / ACTION_DURATION_MS);
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    updateRig(ACTION_DURATION_MS);
    return;
  }
  playStart = performance.now();
  playDurationMs = INTERACTIVE_OPEN_DURATION_S * 1000 * remaining;
  playing = true;
  animationFrame = requestAnimationFrame(tick);
}

hooks.setRigTime = (timeMs) => {
  stop();
  resetPopupMotion(true);
  updateRig(Number(timeMs) || 0);
  return hooks.__rigState;
};
hooks.setRigProgress = (progress) => hooks.setRigTime(Number(progress) * ACTION_DURATION_MS);
hooks.setRigFrame = (frame) => {
  const captureTime = (Number(frame) / CAPTURE_FPS) * 1000;
  return hooks.setRigTime(Math.min(captureTime, ACTION_DURATION_MS));
};
hooks.playRig = () => play();
hooks.__motionProfile = Object.freeze({
  engine: "requestAnimationFrame",
  interactiveDurationMs: Math.round(INTERACTIVE_OPEN_DURATION_S * 1000),
  authoredDurationMs: ACTION_DURATION_MS,
  ease: "power2.inOut",
  reducedMotionOpeningMs: 0,
  parallax: "world-space depth owners with one damped integrator",
});

// The endpoint city is split by geography and depth, never by individual
// facade. Every member of a virtual owner receives the same absolute
// world-space delta from its frozen endpoint matrix:
//
//   local = inverse(parentWorld) * ownerDelta * endpointWorld
//
// This preserves relative matrices inside each owner even when its pieces
// belong to opposite book pages (the obelisk is the critical example). It also
// keeps the authored hinge hierarchy untouched: no child, scale or geometry is
// animated and no incremental offset can accumulate from frame to frame.
const popupReactionRaycaster = new THREE.Raycaster();
const popupReactionNdc = new THREE.Vector2();
const popupReactionChannels = new Map();
const popupReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? { matches: false };
const popupBaseCameraPosition = camera.position.clone();
const popupBaseCameraQuaternion = camera.quaternion.clone();
const popupBaseCameraTarget = viewMode === "side"
  ? new THREE.Vector3(0, 185, 0)
  : new THREE.Vector3(hybridSpike ? -9.5 : 0, hybridSpike ? 5.4 : 24, 0);
const popupCameraUp = camera.up.clone().normalize();
const popupCameraForward = popupBaseCameraTarget.clone().sub(popupBaseCameraPosition).normalize();
const popupCameraRight = new THREE.Vector3().crossVectors(popupCameraForward, popupCameraUp).normalize();
const popupCameraScreenUp = new THREE.Vector3().crossVectors(popupCameraRight, popupCameraForward).normalize();
const popupBaseCameraOffset = popupBaseCameraPosition.clone().sub(popupBaseCameraTarget);
const POPUP_PARALLAX = Object.freeze({
  maxInput: 0.92,
  axis: "vertical",
  maxYawDeg: 0,
  maxPitchDeg: 0,
  touchScale: 0.35,
});
const POPUP_SPATIAL_PROFILES = Object.freeze({
  far: Object.freeze({ verticalWorld: 4, proximityRadius: 0.085, springHz: 1.8, dampingRatio: 0.92 }),
  mid: Object.freeze({ verticalWorld: 7, proximityRadius: 0.095, springHz: 2.15, dampingRatio: 0.86 }),
  near: Object.freeze({ verticalWorld: 11, proximityRadius: 0.11, springHz: 2.55, dampingRatio: 0.8 }),
  // Shared street geometry and the monument base remain physical anchors so
  // neither surface can float away from the page beneath it.
  obelisk: Object.freeze({ verticalWorld: 0, proximityRadius: 0.075, springHz: 1.9, dampingRatio: 0.9 }),
  streets: Object.freeze({ verticalWorld: 0, proximityRadius: 0, springHz: 2.3, dampingRatio: 0.9 }),
});
const popupMotion = {
  pointerActive: false,
  activeOwner: null,
  pointerX: 0,
  pointerY: 0,
  currentX: 0,
  currentY: 0,
  velocityX: 0,
  velocityY: 0,
  frame: 0,
  lastTime: 0,
  reduced: Boolean(popupReducedMotion.matches),
};
let genericReactionZone = null;
let popupRootTransformBaseline = null;
let popupOwnerBaselinesCaptured = false;

function addReactionChannel(id, root, side) {
  if (!root || popupReactionChannels.has(id)) return;
  const printedMaterials = [];
  root.traverse((object) => {
    if (!object.isMesh || !object.userData.printFront) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material?.color) continue;
      printedMaterials.push({ material, color: material.color.clone() });
    }
  });
  popupReactionChannels.set(id, {
    id,
    root,
    side,
    printedMaterials,
  });
}

for (const mechanism of cityPanels) addReactionChannel(mechanism.id, mechanism.root, mechanism.side);
for (const decal of pageDecals) {
  decal.mesh.userData.interactionMechanismId = decal.id;
  addReactionChannel(decal.id, decal.mesh, decal.side);
}

const popupReactionIds = [...popupReactionChannels.keys()];
const zoneIds = (...ids) => Object.freeze([...new Set(ids.flat())]);
const farLeftFigureIds = popupReactionIds.filter(
  (id) => /^far-left-\d+(?:-page-print)?$/u.test(id),
);
const farRightFigureIds = popupReactionIds.filter(
  (id) => /^far-right-\d+(?:-page-print)?$/u.test(id),
);
const nearLeftFigureIds = popupReactionIds.filter(
  (id) => /^near-left-\d+(?:-page-print)?$/u.test(id),
);

// Every root and page-bound print belongs to exactly one geographic owner.
// Far standees, their printed twins and the taxi share the stationary street
// surface; near-left figures share the foreground ground print beneath their
// feet. This prevents ghost pairs and foot sliding while buildings retain the
// three perceptual depth bands. The west stair's leaf-2 is a logical alias
// inside one root and is therefore listed for story routing but never moved twice.
const popupReactionZones = Object.freeze({
  "background-left": zoneIds(
    "rear_skyline_left", "rear_skyline_left_leaf_2", "rear_skyline_left_leaf_3", "rear_skyline_left_leaf_4",
  ),
  "background-right": zoneIds(
    "rear_skyline_right", "rear_skyline_right_leaf_2", "rear_skyline_right_leaf_3", "rear_skyline_right_leaf_4",
  ),
  "middle-left": zoneIds(
    "mid_left_clock_door", "mid_left_right_tower", "mid_left_hall_wedge", "mid-left-continuity-shadow-print",
  ),
  "middle-right": zoneIds(
    "mid_right_dome", "mid_right_terminal", "mid_right_church", "mid_right_church_leaf_2", "mid_right_church_leaf_3",
  ),
  foreground: zoneIds(
    "front_deck_left",
    "front-left-train-fascia", "front-left-train-fascia-leaf-2", "front-left-train-fascia-leaf-3",
    "front-left-stair-west", "front-left-stair-west-leaf-2",
    "front-left-stair-east", "front-left-stair-east-leaf-2", "front-left-stair-east-leaf-3",
    "near-left-ground-print", "near-left-ground-residual-print", "front-left-microdeck-top-print",
    nearLeftFigureIds,
    "near-right-back-facades", "near-right-back-facades-leaf-2", "near-right-back-facades-leaf-3", "near-right-clock-tower",
    "near-right-ground-print",
  ),
  obelisk: zoneIds(
    "obelisk_cross_left", "obelisk_cross", "obelisk-base-left-page-print", "obelisk-base-right-page-print",
  ),
  "streets-shared": zoneIds("taxi-page-print", farLeftFigureIds, farRightFigureIds),
});
const popupSpatialProfileByZone = Object.freeze({
  "background-left": "far",
  "background-right": "far",
  "middle-left": "mid",
  "middle-right": "mid",
  foreground: "near",
  obelisk: "obelisk",
  "streets-shared": "streets",
});
// Only architecture defines pointer proximity. Ground prints, continuity
// underlays and physical/printed people still travel with their owner, but do
// not make its interactive footprint spill across the whole page.
const popupZoneInfluenceIds = Object.freeze({
  "background-left": zoneIds(
    "rear_skyline_left", "rear_skyline_left_leaf_2", "rear_skyline_left_leaf_3", "rear_skyline_left_leaf_4",
  ),
  "background-right": zoneIds(
    "rear_skyline_right", "rear_skyline_right_leaf_2", "rear_skyline_right_leaf_3", "rear_skyline_right_leaf_4",
  ),
  "middle-left": zoneIds("mid_left_clock_door", "mid_left_right_tower", "mid_left_hall_wedge"),
  "middle-right": zoneIds(
    "mid_right_dome", "mid_right_terminal", "mid_right_church", "mid_right_church_leaf_2", "mid_right_church_leaf_3",
  ),
  foreground: zoneIds(
    "front-left-train-fascia", "front-left-train-fascia-leaf-2", "front-left-train-fascia-leaf-3",
    "front-left-stair-west", "front-left-stair-east", "front-left-stair-east-leaf-2", "front-left-stair-east-leaf-3",
    "near-right-back-facades", "near-right-back-facades-leaf-2", "near-right-back-facades-leaf-3", "near-right-clock-tower",
  ),
  obelisk: zoneIds("obelisk_cross_left", "obelisk_cross"),
  "streets-shared": Object.freeze([]),
});
const popupReactionZoneById = new Map();
for (const [zone, ids] of Object.entries(popupReactionZones)) {
  for (const id of ids) popupReactionZoneById.set(id, zone);
}
const popupZoneStates = new Map(Object.entries(popupReactionZones).map(([name, ids]) => [name, {
  name,
  ids: [...new Set(ids)],
  spatialProfile: popupSpatialProfileByZone[name],
  hover: 0,
  cue: 0,
  value: 0,
  velocity: 0,
  channels: [...new Set(ids)].map((id) => popupReactionChannels.get(id)).filter(Boolean),
}]));
const popupSpatialStates = new Map(Object.keys(popupReactionZones).map((name) => {
  const profileName = popupSpatialProfileByZone[name];
  return [name, {
    name,
    profileName,
    profile: POPUP_SPATIAL_PROFILES[profileName],
    target: 0,
    proximity: 0,
    value: 0,
    velocity: 0,
    worldDelta: new THREE.Vector3(),
  }];
}));

for (const [id, channel] of popupReactionChannels) {
  const zoneName = popupReactionZoneById.get(id);
  if (!zoneName) throw new Error(`Reactive channel without geographic owner: ${id}`);
  channel.zoneName = zoneName;
  channel.spatialProfile = popupSpatialProfileByZone[zoneName];
}

function zoneNameForReactionId(id) {
  return popupReactionZoneById.get(id) ?? null;
}

function zoneNamesForReactionIds(ids) {
  return [...new Set((ids ?? []).map(zoneNameForReactionId).filter(Boolean))];
}

function zoneVisualTarget(zone) {
  return Math.max(zone.hover * 0.28, zone.cue);
}

function springStep(value, velocity, target, frequencyHz, dampingRatio, dt) {
  const omega = Math.PI * 2 * frequencyHz;
  const steps = Math.max(1, Math.ceil(dt * 120));
  const stepDt = dt / steps;
  let nextValue = value;
  let nextVelocity = velocity;
  for (let step = 0; step < steps; step += 1) {
    const acceleration = (target - nextValue) * omega * omega
      - nextVelocity * 2 * dampingRatio * omega;
    nextVelocity += acceleration * stepDt;
    nextValue += nextVelocity * stepDt;
  }
  return {
    value: nextValue,
    velocity: nextVelocity,
  };
}

function popupRigAtEndpoint() {
  return (hooks.__rigState?.timeMs ?? 0) >= ACTION_DURATION_MS - 1;
}

function capturePopupOwnerBaselines() {
  if (!popupRigAtEndpoint()) return false;
  if (popupOwnerBaselinesCaptured) return true;
  scene.updateMatrixWorld(true);
  for (const channel of popupReactionChannels.values()) {
    channel.root.updateWorldMatrix(true, true);
    channel.parent = channel.root.parent;
    channel.baseWorldMatrix = channel.root.matrixWorld.clone();
    channel.basePosition = channel.root.position.clone();
    channel.baseQuaternion = channel.root.quaternion.clone();
    channel.baseScale = channel.root.scale.clone();
    channel.baseBoundsWorld = new THREE.Box3().setFromObject(channel.root);
  }
  popupOwnerBaselinesCaptured = true;
  capturePopupRootTransformBaseline();
  return true;
}

function restorePopupOwnerBaselines() {
  if (!popupOwnerBaselinesCaptured) return;
  for (const channel of popupReactionChannels.values()) {
    channel.root.position.copy(channel.basePosition);
    channel.root.quaternion.copy(channel.baseQuaternion);
    channel.root.scale.copy(channel.baseScale);
    channel.root.updateMatrix();
  }
  for (const state of popupSpatialStates.values()) state.worldDelta.set(0, 0, 0);
  scene.updateMatrixWorld(true);
}

const popupOwnerDeltaMatrix = new THREE.Matrix4();
const popupOwnerParentInverse = new THREE.Matrix4();
const popupOwnerLocalMatrix = new THREE.Matrix4();
function applyPopupDepthOwners() {
  if (!popupRigAtEndpoint()) {
    restorePopupOwnerBaselines();
    return;
  }
  if (!capturePopupOwnerBaselines()) return;
  const active = !popupMotion.reduced && viewMode === "hero";
  for (const state of popupSpatialStates.values()) {
    state.worldDelta.copy(popupCameraScreenUp).multiplyScalar(
      active ? state.value * state.profile.verticalWorld : 0,
    );
  }
  scene.updateMatrixWorld(true);
  for (const channel of popupReactionChannels.values()) {
    const spatial = popupSpatialStates.get(channel.zoneName);
    popupOwnerDeltaMatrix.makeTranslation(
      spatial.worldDelta.x,
      spatial.worldDelta.y,
      spatial.worldDelta.z,
    );
    channel.parent.updateWorldMatrix(true, false);
    popupOwnerParentInverse.copy(channel.parent.matrixWorld).invert();
    popupOwnerLocalMatrix.copy(popupOwnerParentInverse)
      .multiply(popupOwnerDeltaMatrix)
      .multiply(channel.baseWorldMatrix);
    popupOwnerLocalMatrix.decompose(
      channel.root.position,
      channel.root.quaternion,
      channel.root.scale,
    );
    channel.root.updateMatrix();
  }
  scene.updateMatrixWorld(true);
}

function applyPopupCamera() {
  if (
    !popupRigAtEndpoint()
    || popupMotion.reduced
    || viewMode !== "hero"
    || (POPUP_PARALLAX.maxYawDeg === 0 && POPUP_PARALLAX.maxPitchDeg === 0)
    || (Math.abs(popupMotion.currentX) < 1e-8 && Math.abs(popupMotion.currentY) < 1e-8)
  ) {
    camera.position.copy(popupBaseCameraPosition);
    camera.quaternion.copy(popupBaseCameraQuaternion);
    camera.updateMatrixWorld(true);
    return;
  }
  const yaw = THREE.MathUtils.degToRad(popupMotion.currentX * POPUP_PARALLAX.maxYawDeg);
  const pitch = THREE.MathUtils.degToRad(popupMotion.currentY * POPUP_PARALLAX.maxPitchDeg);
  const offset = popupBaseCameraOffset.clone()
    .applyAxisAngle(popupCameraUp, yaw)
    .applyAxisAngle(popupCameraRight, pitch);
  camera.position.copy(popupBaseCameraTarget).add(offset);
  camera.lookAt(popupBaseCameraTarget);
  camera.updateMatrixWorld(true);
}

const popupWarmth = new THREE.Color(0xffdf9c);
function applyPopupZoneMaterials() {
  for (const zone of popupZoneStates.values()) {
    const strength = THREE.MathUtils.clamp(zone.value, 0, 1) * 0.07;
    for (const channel of zone.channels) {
      if (!channel.root.visible) continue;
      for (const item of channel.printedMaterials) {
        item.material.color.copy(item.color).lerp(popupWarmth, strength);
      }
    }
  }
}

function popupMotionSettled() {
  const depthSettled = [...popupSpatialStates.values()].every((state) => (
    Math.abs(state.value - state.target) < 0.00035
    && Math.abs(state.velocity) < 0.002
  ));
  const zonesSettled = [...popupZoneStates.values()].every((zone) => (
    Math.abs(zone.value - zoneVisualTarget(zone)) < 0.0005 && Math.abs(zone.velocity) < 0.003
  ));
  return depthSettled && zonesSettled;
}

function popupMotionTick(now) {
  popupMotion.frame = 0;
  const dt = popupMotion.lastTime === 0
    ? 1 / 60
    : THREE.MathUtils.clamp((now - popupMotion.lastTime) / 1000, 1 / 240, 1 / 30);
  popupMotion.lastTime = now;
  for (const state of popupSpatialStates.values()) {
    const next = popupMotion.reduced
      ? { value: 0, velocity: 0 }
      : springStep(state.value, state.velocity, state.target, state.profile.springHz, state.profile.dampingRatio, dt);
    state.value = THREE.MathUtils.clamp(next.value, -0.06, 1.06);
    state.velocity = next.velocity;
  }
  for (const zone of popupZoneStates.values()) {
    const next = popupMotion.reduced
      ? { value: zoneVisualTarget(zone), velocity: 0 }
      : springStep(zone.value, zone.velocity, zoneVisualTarget(zone), 4.6, 0.86, dt);
    zone.value = THREE.MathUtils.clamp(next.value, 0, 1);
    zone.velocity = next.velocity;
  }
  const settled = popupMotionSettled();
  if (settled) {
    for (const state of popupSpatialStates.values()) {
      state.value = popupMotion.reduced ? 0 : state.target;
      state.velocity = 0;
    }
    for (const zone of popupZoneStates.values()) {
      zone.value = zoneVisualTarget(zone);
      zone.velocity = 0;
    }
  }
  applyPopupDepthOwners();
  applyPopupCamera();
  applyPopupZoneMaterials();
  renderFrame();
  window.dispatchEvent(new CustomEvent("popup-parallax-frame"));
  if (!settled) popupMotion.frame = requestAnimationFrame(popupMotionTick);
  else popupMotion.lastTime = 0;
}

function schedulePopupMotion() {
  if (popupMotion.frame) return;
  popupMotion.lastTime = 0;
  popupMotion.frame = requestAnimationFrame(popupMotionTick);
}

function updatePopupMotion({ immediate = false } = {}) {
  if (popupMotion.reduced || immediate) {
    cancelAnimationFrame(popupMotion.frame);
    popupMotion.frame = 0;
    popupMotion.lastTime = 0;
    popupMotion.currentX = 0;
    popupMotion.currentY = 0;
    popupMotion.velocityX = 0;
    popupMotion.velocityY = 0;
    for (const state of popupSpatialStates.values()) {
      if (popupMotion.reduced) state.target = 0;
      state.value = popupMotion.reduced ? 0 : state.target;
      state.velocity = 0;
    }
    for (const zone of popupZoneStates.values()) {
      zone.value = zoneVisualTarget(zone);
      zone.velocity = 0;
    }
    applyPopupDepthOwners();
    applyPopupCamera();
    applyPopupZoneMaterials();
    renderFrame();
    window.dispatchEvent(new CustomEvent("popup-parallax-frame"));
    return;
  }
  schedulePopupMotion();
}

function setGenericReaction(id) {
  const nextZone = id ? zoneNameForReactionId(id) : null;
  if (nextZone === genericReactionZone) return;
  if (genericReactionZone) popupZoneStates.get(genericReactionZone).hover = 0;
  if (nextZone) popupZoneStates.get(nextZone).hover = 1;
  genericReactionZone = nextZone;
  updatePopupMotion();
}

const cueMechanisms = Object.freeze({
  taxi: ["taxi-page-print"],
  calle: ["taxi-page-print", "far-left-04"],
  ochava: ["near-right-back-facades"],
  retiro: ["front-left-stair-east", "front-left-train-fascia"],
  torre: ["mid_left_right_tower"],
  campanario: ["mid_right_church"],
  puerta: ["mid_left_clock_door"],
});

function setPopupReactions(mechanismIds, intensity = 0) {
  const cue = THREE.MathUtils.clamp(Number(intensity) || 0, 0, 1) * 0.62;
  for (const zoneName of zoneNamesForReactionIds(mechanismIds)) popupZoneStates.get(zoneName).cue = cue;
  updatePopupMotion();
}

hooks.__popupReactionIds = Object.freeze([...popupReactionChannels.keys()]);
hooks.__popupReactionZones = popupReactionZones;
hooks.__popupDepthOwners = Object.freeze(Object.fromEntries(
  Object.entries(popupReactionZones).map(([name, ids]) => [name, Object.freeze({
    profile: popupSpatialProfileByZone[name],
    ids,
  })]),
));
hooks.__popupReactionState = () => Object.fromEntries(
  [...popupZoneStates].map(([name, zone]) => [name, {
    hover: zone.hover,
    cue: zone.cue,
    value: zone.value,
    velocity: zone.velocity,
  }]),
);
hooks.__setPopupReactions = setPopupReactions;
hooks.__setPopupCueReaction = (cue, intensity = 0) => {
  setPopupReactions(cueMechanisms[cue], intensity);
};

const popupInfluenceCorner = new THREE.Vector3();
function projectedBaseBounds(channel, canvasRect) {
  const bounds = channel.baseBoundsWorld;
  if (!bounds || bounds.isEmpty()) return null;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        popupInfluenceCorner.set(x, y, z).project(camera);
        const screenX = canvasRect.left + (popupInfluenceCorner.x * 0.5 + 0.5) * canvasRect.width;
        const screenY = canvasRect.top + (-popupInfluenceCorner.y * 0.5 + 0.5) * canvasRect.height;
        left = Math.min(left, screenX);
        right = Math.max(right, screenX);
        top = Math.min(top, screenY);
        bottom = Math.max(bottom, screenY);
      }
    }
  }
  return { left, right, top, bottom };
}

function distanceToScreenBounds(x, y, bounds) {
  const centerX = (bounds.left + bounds.right) * 0.5;
  const centerY = (bounds.top + bounds.bottom) * 0.5;
  const halfWidth = (bounds.right - bounds.left) * 0.29;
  const halfHeight = (bounds.bottom - bounds.top) * 0.29;
  const dx = Math.max(Math.abs(x - centerX) - halfWidth, 0);
  const dy = Math.max(Math.abs(y - centerY) - halfHeight, 0);
  return Math.hypot(dx, dy);
}

function normalizedDistanceToBoundsCenter(x, y, bounds) {
  const centerX = (bounds.left + bounds.right) * 0.5;
  const centerY = (bounds.top + bounds.bottom) * 0.5;
  const normalizer = Math.max(20, Math.hypot(
    bounds.right - bounds.left,
    bounds.bottom - bounds.top,
  ) * 0.5);
  return Math.hypot(x - centerX, y - centerY) / normalizer;
}

function updatePopupProximityTargets(clientX, clientY, scale = 1) {
  if (!capturePopupOwnerBaselines()) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const candidates = [];
  for (const [zoneName, state] of popupSpatialStates) {
    state.target = 0;
    let distance = Infinity;
    let centerDistance = Infinity;
    for (const id of popupZoneInfluenceIds[zoneName]) {
      const channel = popupReactionChannels.get(id);
      if (!channel) continue;
      const bounds = projectedBaseBounds(channel, rect);
      if (!bounds) continue;
      const nextDistance = distanceToScreenBounds(clientX, clientY, bounds);
      const nextCenterDistance = normalizedDistanceToBoundsCenter(clientX, clientY, bounds);
      if (
        nextDistance < distance - 1e-6
        || (Math.abs(nextDistance - distance) <= 1e-6 && nextCenterDistance < centerDistance)
      ) {
        distance = nextDistance;
        centerDistance = nextCenterDistance;
      }
    }
    const radius = Math.max(34, Math.min(rect.width, rect.height) * state.profile.proximityRadius);
    const proximity = Number.isFinite(distance)
      ? 1 - THREE.MathUtils.smoothstep(distance, 0, radius)
      : 0;
    state.proximity = THREE.MathUtils.clamp(proximity, 0, 1);
    if (!Number.isFinite(distance)) continue;
    candidates.push({
      zoneName,
      state,
      centerDistance,
      selectionScore: state.proximity - Math.min(centerDistance, 2) * 0.12,
    });
  }

  candidates.sort((left, right) => (
    right.selectionScore - left.selectionScore
    || right.state.proximity - left.state.proximity
    || left.centerDistance - right.centerDistance
    || right.state.profile.verticalWorld - left.state.profile.verticalWorld
  ));
  const selection = candidates.find((candidate) => candidate.state.proximity > 0) ?? null;
  let winner = selection?.state.profile.verticalWorld > 0 ? selection : null;
  const incumbent = popupMotion.activeOwner
    ? candidates.find((candidate) => candidate.zoneName === popupMotion.activeOwner)
    : null;
  if (
    winner
    && incumbent
    && incumbent.state.proximity > 0
    && winner.zoneName !== incumbent.zoneName
    && winner.selectionScore - incumbent.selectionScore < 0.035
  ) winner = incumbent;

  popupMotion.activeOwner = winner?.zoneName ?? null;
  if (winner) {
    winner.state.target = Math.pow(winner.state.proximity, 1.35)
      * POPUP_PARALLAX.maxInput
      * scale;
  }
}

function setPopupPointerPosition(x, y, { scale = 1, immediate = false } = {}) {
  if (!popupRigAtEndpoint() || popupMotion.reduced || viewMode !== "hero") return;
  const rect = renderer.domElement.getBoundingClientRect();
  popupMotion.pointerActive = true;
  popupMotion.pointerX = THREE.MathUtils.clamp(Number(x) || 0, -1, 1);
  popupMotion.pointerY = THREE.MathUtils.clamp(Number(y) || 0, -1, 1);
  const clientX = rect.left + (popupMotion.pointerX * 0.5 + 0.5) * rect.width;
  const clientY = rect.top + (-popupMotion.pointerY * 0.5 + 0.5) * rect.height;
  updatePopupProximityTargets(clientX, clientY, scale);
  capturePopupRootTransformBaseline();
  updatePopupMotion({ immediate });
}

function setPointerMotion(event, scale = 1) {
  if (!popupRigAtEndpoint() || popupMotion.reduced || viewMode !== "hero") return;
  const rect = renderer.domElement.getBoundingClientRect();
  if (
    event.clientX < rect.left
    || event.clientX > rect.right
    || event.clientY < rect.top
    || event.clientY > rect.bottom
  ) {
    resetPointerMotion();
    return;
  }
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  setPopupPointerPosition(x, y, { scale });
}

function resetPointerMotion({ immediate = false } = {}) {
  popupMotion.pointerActive = false;
  popupMotion.activeOwner = null;
  popupMotion.pointerX = 0;
  popupMotion.pointerY = 0;
  for (const state of popupSpatialStates.values()) {
    state.target = 0;
    state.proximity = 0;
  }
  updatePopupMotion({ immediate });
}

function resetPopupMotion(immediate = false) {
  popupMotion.pointerX = 0;
  popupMotion.pointerY = 0;
  popupMotion.pointerActive = false;
  popupMotion.activeOwner = null;
  genericReactionZone = null;
  for (const zone of popupZoneStates.values()) {
    zone.hover = 0;
    zone.cue = 0;
  }
  if (immediate) {
    popupMotion.currentX = 0;
    popupMotion.currentY = 0;
    popupMotion.velocityX = 0;
    popupMotion.velocityY = 0;
    for (const state of popupSpatialStates.values()) {
      state.target = 0;
      state.proximity = 0;
      state.value = 0;
      state.velocity = 0;
    }
    restorePopupOwnerBaselines();
    camera.position.copy(popupBaseCameraPosition);
    camera.quaternion.copy(popupBaseCameraQuaternion);
    camera.updateMatrixWorld(true);
  }
  updatePopupMotion({ immediate });
}

function capturePopupRootTransformBaseline() {
  if (popupRootTransformBaseline || (hooks.__rigState?.timeMs ?? 0) < ACTION_DURATION_MS - 1) return;
  popupRootTransformBaseline = new Map([...popupReactionChannels].map(([id, channel]) => {
    channel.root.updateMatrix();
    return [id, [...channel.root.matrix.elements]];
  }));
}

const popupNeutralProjectionCamera = camera.clone();
const popupScreenCurrent = new THREE.Vector3();
const popupScreenNeutral = new THREE.Vector3();
function popupReactionScreenOffset(ids) {
  if (
    popupMotion.reduced
    || viewMode !== "hero"
    || (hooks.__rigState?.timeMs ?? 0) < ACTION_DURATION_MS - 1
    || !capturePopupOwnerBaselines()
  ) return { x: 0, y: 0 };
  popupNeutralProjectionCamera.projectionMatrix.copy(camera.projectionMatrix);
  popupNeutralProjectionCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  popupNeutralProjectionCamera.position.copy(popupBaseCameraPosition);
  popupNeutralProjectionCamera.quaternion.copy(popupBaseCameraQuaternion);
  popupNeutralProjectionCamera.updateMatrixWorld(true);
  const rect = renderer.domElement.getBoundingClientRect();
  const seenZones = new Set();
  let x = 0;
  let y = 0;
  let count = 0;
  for (const id of ids ?? []) {
    const channel = popupReactionChannels.get(id)
      ?? popupZoneStates.get(zoneNameForReactionId(id))?.channels[0];
    if (!channel || seenZones.has(channel.zoneName)) continue;
    seenZones.add(channel.zoneName);
    if (!channel.anchorLocal) {
      const center = new THREE.Box3().setFromObject(channel.root).getCenter(new THREE.Vector3());
      channel.anchorLocal = channel.root.worldToLocal(center);
    }
    popupScreenCurrent.copy(channel.anchorLocal);
    channel.root.localToWorld(popupScreenCurrent);
    popupScreenNeutral.copy(popupScreenCurrent).sub(
      popupSpatialStates.get(channel.zoneName).worldDelta,
    );
    popupScreenCurrent.project(camera);
    popupScreenNeutral.project(popupNeutralProjectionCamera);
    x += (popupScreenCurrent.x - popupScreenNeutral.x) * rect.width * 0.5;
    y += -(popupScreenCurrent.y - popupScreenNeutral.y) * rect.height * 0.5;
    count += 1;
  }
  return count > 0 ? { x: x / count, y: y / count } : { x: 0, y: 0 };
}

function popupMotionIntegrity() {
  if (!capturePopupOwnerBaselines()) {
    return {
      captured: false,
      maxOwnerRelativeMatrixDelta: 0,
      resetLocalMatrixDelta: null,
      changedOwners: [],
    };
  }
  scene.updateMatrixWorld(true);
  let maxOwnerRelativeMatrixDelta = 0;
  const changedOwners = [];
  for (const [zoneName] of popupSpatialStates) {
    const members = [...popupReactionChannels.values()].filter(
      (channel) => channel.zoneName === zoneName,
    );
    const baseInverse = members[0].baseWorldMatrix.clone().invert();
    const currentInverse = members[0].root.matrixWorld.clone().invert();
    for (const channel of members) {
      const expected = baseInverse.clone().multiply(channel.baseWorldMatrix);
      const current = currentInverse.clone().multiply(channel.root.matrixWorld);
      const delta = Math.max(...current.elements.map(
        (value, index) => Math.abs(value - expected.elements[index]),
      ));
      maxOwnerRelativeMatrixDelta = Math.max(maxOwnerRelativeMatrixDelta, delta);
      if (delta > 1e-8) changedOwners.push({ zone: zoneName, id: channel.id, delta });
    }
  }
  const neutral = [...popupSpatialStates.values()].every(
    (state) => Math.abs(state.value) < 1e-8,
  );
  let resetLocalMatrixDelta = null;
  if (neutral && popupRootTransformBaseline) {
    resetLocalMatrixDelta = 0;
    for (const [id, channel] of popupReactionChannels) {
      channel.root.updateMatrix();
      const baseline = popupRootTransformBaseline.get(id);
      const delta = Math.max(...channel.root.matrix.elements.map(
        (value, index) => Math.abs(value - baseline[index]),
      ));
      resetLocalMatrixDelta = Math.max(resetLocalMatrixDelta, delta);
    }
  }
  return {
    captured: true,
    maxOwnerRelativeMatrixDelta,
    resetLocalMatrixDelta,
    changedOwners,
    channels: popupReactionChannels.size,
  };
}

hooks.__popupMotionProfile = Object.freeze({
  owner: "single nearest proximity-driven world-space owner",
  axis: POPUP_PARALLAX.axis,
  zones: Object.keys(popupReactionZones),
  influenceIds: popupZoneInfluenceIds,
  spatialProfiles: Object.fromEntries(Object.entries(POPUP_SPATIAL_PROFILES).map(([name, profile]) => [name, { ...profile }])),
  maxYawDeg: POPUP_PARALLAX.maxYawDeg,
  maxPitchDeg: POPUP_PARALLAX.maxPitchDeg,
  touch: "local vertical tap impulse; horizontal pan remains native",
});
hooks.__popupMotionState = () => ({
  reducedMotion: popupMotion.reduced,
  pointerActive: popupMotion.pointerActive,
  activeOwner: popupMotion.activeOwner,
  pointer: [popupMotion.pointerX, popupMotion.pointerY],
  current: [popupMotion.currentX, popupMotion.currentY],
  velocity: [popupMotion.velocityX, popupMotion.velocityY],
  owners: Object.fromEntries([...popupSpatialStates].map(([name, state]) => [name, {
    profile: state.profileName,
    target: state.target,
    proximity: state.proximity ?? 0,
    value: state.value,
    velocity: state.velocity,
    worldDelta: state.worldDelta.toArray(),
  }])),
  camera: camera.position.toArray(),
  integrity: popupMotionIntegrity(),
});
hooks.__popupMotionIntegrity = popupMotionIntegrity;
hooks.__popupReactionScreenOffset = popupReactionScreenOffset;
hooks.setPopupMotion = (x = 0, y = 0, options = {}) => {
  setPopupPointerPosition(x, y, { immediate: options.immediate !== false });
  return hooks.__popupMotionState();
};
hooks.setPopupPointer = hooks.setPopupMotion;
hooks.__releasePopupPointer = (options = {}) => {
  resetPointerMotion({ immediate: options.immediate === true });
  return hooks.__popupMotionState();
};
hooks.resetPopupMotion = () => {
  resetPopupMotion(true);
  return hooks.__popupMotionState();
};

const handleReducedMotionChange = (event) => {
  popupMotion.reduced = Boolean(event.matches);
  if (popupMotion.reduced && (playing || animationFrame)) {
    stop();
    updateRig(ACTION_DURATION_MS);
  }
  cancelAnimationFrame(popupMotion.frame);
  popupMotion.frame = 0;
  popupMotion.lastTime = 0;
  popupMotion.pointerActive = false;
  popupMotion.activeOwner = null;
  popupMotion.pointerX = 0;
  popupMotion.pointerY = 0;
  popupMotion.currentX = 0;
  popupMotion.currentY = 0;
  popupMotion.velocityX = 0;
  popupMotion.velocityY = 0;
  for (const state of popupSpatialStates.values()) {
    state.target = 0;
    state.proximity = 0;
    state.value = 0;
    state.velocity = 0;
  }
  restorePopupOwnerBaselines();
  updatePopupMotion({ immediate: popupMotion.reduced });
};
if (popupReducedMotion.addEventListener) popupReducedMotion.addEventListener("change", handleReducedMotionChange);
else popupReducedMotion.addListener?.(handleReducedMotionChange);

function popupReactionHit(event) {
  if ((hooks.__rigState?.timeMs ?? 0) < ACTION_DURATION_MS - 1) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return null;
  popupReactionNdc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -(((event.clientY - rect.top) / rect.height) * 2 - 1),
  );
  popupReactionRaycaster.setFromCamera(popupReactionNdc, camera);
  const targets = [];
  for (const channel of popupReactionChannels.values()) {
    channel.root.traverse((object) => {
      if (object.isMesh && object.userData.printFront && object.visible) targets.push(object);
    });
  }
  const hit = popupReactionRaycaster.intersectObjects(targets, false)[0];
  return hit?.object.userData.interactionMechanismId ?? null;
}

// Opening belongs to the physical book, not to the fullscreen WebGL canvas.
// Hit testing is performed against the actual closed-book meshes, so the
// interactive silhouette stays correct at every responsive canvas size.
const bookPointerRaycaster = new THREE.Raycaster();
const bookPointerNdc = new THREE.Vector2();
const closedBookHitTargets = [
  coverFront,
  coverBoard,
  fixedSpineCasing,
  movingSpineCasing,
  leftClosedTop,
  leftBody,
  rightBody,
  leftClosedEdgeSkin,
  rightClosedEdgeSkin,
  bindingHead,
];

function bookPointerHitAt(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (
    clientX < rect.left
    || clientX > rect.right
    || clientY < rect.top
    || clientY > rect.bottom
  ) return false;
  bookPointerNdc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  );
  bookPointerRaycaster.setFromCamera(bookPointerNdc, camera);
  return bookPointerRaycaster
    .intersectObjects(closedBookHitTargets, true)
    .some(({ object }) => object.visible);
}

function bookPointerHit(event) {
  return bookPointerHitAt(event.clientX, event.clientY);
}

hooks.__bookPointerHit = bookPointerHit;
hooks.__bookPointerHitAt = bookPointerHitAt;

// Non-UI review hook.  It lets the fidelity board isolate one or more
// physical assemblies without changing the production render path.
if (isolateIds.size > 0) {
  for (const mechanism of cityPanels) {
    mechanism.root.visible = isolateIds.has(mechanism.id);
  }
  for (const decal of pageDecals) decal.mesh.visible = false;
}

const handlePointerMove = (event) => {
  const time = hooks.__rigState?.timeMs ?? 0;
  const closed = time < 1;
  const open = time >= ACTION_DURATION_MS - 1;
  const readerOpen = reader?.classList.contains("is-open");
  const eventOnStage = event.composedPath().includes(stage);
  stage.classList.toggle("is-book-hit", closed && eventOnStage && bookPointerHit(event));
  if (!open || readerOpen || event.pointerType === "touch") return;
  setPointerMotion(event);
  setGenericReaction(popupReactionHit(event));
};
const handlePointerDown = (event) => {
  const readerOpen = reader?.classList.contains("is-open");
  if (readerOpen || event.pointerType !== "touch" || (hooks.__rigState?.timeMs ?? 0) < ACTION_DURATION_MS - 1) return;
  setPointerMotion(event, POPUP_PARALLAX.touchScale);
  setGenericReaction(popupReactionHit(event));
};
const handlePointerUp = (event) => {
  if (event.pointerType !== "touch") return;
  resetPointerMotion();
  setGenericReaction(null);
};
const handlePointerCancel = (event) => {
  if (event.pointerType !== "touch") return;
  resetPointerMotion();
  setGenericReaction(null);
};
const handlePointerLeave = () => {
  stage.classList.remove("is-book-hit");
  resetPointerMotion();
  setGenericReaction(null);
};
const handleScroll = () => {
  resetPointerMotion();
  setGenericReaction(null);
};
const handleBlur = () => {
  resetPointerMotion();
  setGenericReaction(null);
};
const handleVisibilityChange = () => {
  if (!document.hidden) return;
  resetPointerMotion({ immediate: true });
  setGenericReaction(null);
};
const handleStageClick = (event) => {
  if (params.has("frame") || params.has("t")) return;
  if (!bookPointerHit(event)) return;
  stage.classList.remove("is-book-hit");
  if (runtimeMode) {
    if (!playing && (hooks.__rigState?.timeMs ?? 0) < ACTION_DURATION_MS) play();
    return;
  }
  if (playing) stop();
  else play();
};
listen(window, "pointermove", handlePointerMove);
listen(window, "pointerdown", handlePointerDown);
listen(window, "pointerup", handlePointerUp);
listen(window, "pointercancel", handlePointerCancel);
listen(stage, "pointerleave", handlePointerLeave);
listen(stage, "scroll", handleScroll, { passive: true });
listen(window, "blur", handleBlur);
listen(document, "visibilitychange", handleVisibilityChange);
listen(stage, "click", handleStageClick);

const directFrame = params.get("frame");
const directTime = params.get("t");
if (directFrame !== null) {
  hooks.setRigFrame(THREE.MathUtils.clamp(Number(directFrame), 0, CAPTURE_FRAMES - 1));
} else if (directTime !== null) {
  hooks.setRigTime(Number(directTime));
} else {
  updateRig(0);
  if (params.get("autoplay") === "1" || params.get("debugHotspots") === "1") play(0);
}

hooks.__rigVariant = Object.freeze({ runtime: runtimeMode, hybrid: hybridSpike });
hooks.__rigReady = true;
const captureHookNames = Object.keys(hooks);
if (options.exposeCaptureHooks) Object.assign(window, hooks);
window.dispatchEvent(new CustomEvent("rig-ready"));

let destroyed = false;
function destroy() {
  if (destroyed) return;
  destroyed = true;
  lifecycle.abort();
  stop();
  cancelAnimationFrame(popupMotion.frame);
  popupMotion.frame = 0;
  popupReducedMotion.removeEventListener?.("change", handleReducedMotionChange);
  popupReducedMotion.removeListener?.(handleReducedMotionChange);
  const textures = new Set();
  const materials = new Set();
  for (const graph of [backgroundScene, overlayScene, scene]) {
    graph.traverse((object) => {
      object.geometry?.dispose?.();
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of objectMaterials) {
        if (!material || materials.has(material)) continue;
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value?.isTexture) textures.add(value);
        }
        for (const uniform of Object.values(material.uniforms ?? {})) {
          if (uniform?.value?.isTexture) textures.add(uniform.value);
        }
      }
    });
  }
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  renderer.setAnimationLoop(null);
  renderer.renderLists?.dispose?.();
  renderer.dispose();
  renderer.forceContextLoss?.();
  renderer.domElement.remove();
  stage.classList.remove("is-book-hit");
  if (options.exposeCaptureHooks) {
    for (const key of captureHookNames) {
      if (window[key] === hooks[key]) delete window[key];
    }
  }
}

return Object.freeze({
  play,
  stop,
  destroy,
  setTime: hooks.setRigTime,
  setProgress: hooks.setRigProgress,
  setFrame: hooks.setRigFrame,
  setPopupMotion: hooks.setPopupMotion,
  resetPopupMotion: hooks.resetPopupMotion,
  setPopupReactions,
  bookPointerHit,
  reactionScreenOffset: popupReactionScreenOffset,
  get state() { return hooks.__rigState; },
  get diagnostics() { return hooks.__rigDiagnostics; },
});
}
