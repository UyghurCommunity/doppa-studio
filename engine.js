// Original 2D ornament drawings. Pure, DOM-free generation and validated scene data.
export const TYPES = Object.freeze(['almond', 'rosette', 'atlas']);
export const PALETTES = Object.freeze({
  midnight: Object.freeze({ cloth: '#102d3d', thread: '#c4e9ee', detail: '#4d9dad', trim: '#d8b474' }),
  garden: Object.freeze({ cloth: '#173c33', thread: '#f0e5bd', detail: '#82bba0', trim: '#d9ac66' }),
  pomegranate: Object.freeze({ cloth: '#541e36', thread: '#f8ddce', detail: '#c47a91', trim: '#e8b96e' }),
  porcelain: Object.freeze({ cloth: '#f2ecdc', thread: '#174d73', detail: '#71a6b0', trim: '#b68743' }),
});
export const DEFAULTS = Object.freeze({ version: 1, width: 960, height: 720, mode: 'repeat', motif: 'almond', spacing: 120, size: 78, rotation: 0, symmetry: 'mirror', seed: 24, palette: PALETTES.midnight, placements: Object.freeze([]) });
const ALLOWED = Object.keys(DEFAULTS);
const fail = (message) => { throw new TypeError(message); };
const clone = (value) => JSON.parse(JSON.stringify(value));
function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}: expected an object`);
  if (Object.keys(value).some((key) => !keys.includes(key))) fail(`${label}: unknown property`);
}
function number(value, min, max, label, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(`${label}: expected ${min}–${max}${integer ? ' integer' : ''}`);
  return value;
}
function choice(value, options, label) { if (!options.includes(value)) fail(`${label}: unsupported value`); return value; }
export function validateConfig(input = {}) {
  object(input, ALLOWED, 'Scene');
  const scene = { ...clone(DEFAULTS), ...input };
  if (scene.version !== 1) fail('Unsupported scene version');
  number(scene.width, 240, 2048, 'Width', true); number(scene.height, 240, 2048, 'Height', true);
  choice(scene.mode, ['repeat', 'custom'], 'Mode'); choice(scene.motif, TYPES, 'Motif');
  number(scene.spacing, 48, 240, 'Spacing'); number(scene.size, 16, 180, 'Size');
  number(scene.rotation, -180, 180, 'Rotation'); number(scene.seed, 0, 999999, 'Seed', true);
  choice(scene.symmetry, ['none', 'mirror', 'four'], 'Symmetry');
  object(scene.palette, ['cloth', 'thread', 'detail', 'trim'], 'Palette');
  scene.palette = { ...PALETTES.midnight, ...scene.palette };
  for (const color of Object.values(scene.palette)) if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) fail('Colors must use #RRGGBB');
  if (!Array.isArray(scene.placements) || scene.placements.length > 200) fail('Use at most 200 placed motifs');
  const ids = new Set();
  scene.placements = scene.placements.map((item) => {
    object(item, ['id', 'type', 'x', 'y', 'size', 'rotation'], 'Motif placement');
    const { id, type, x, y, size, rotation } = item;
    number(id, 1, 1000000, 'Placement ID', true); if (ids.has(id)) fail('Duplicate placement ID'); ids.add(id);
    choice(type, TYPES, 'Placed motif'); number(x, 0, scene.width, 'X'); number(y, 0, scene.height, 'Y');
    number(size, 16, 180, 'Placed size'); number(rotation, -180, 180, 'Placed rotation');
    return { id, type, x, y, size, rotation };
  });
  return clone(scene);
}
export function parseConfig(json) {
  if (typeof json !== 'string' || json.length > 250000) fail('Scene file is too large');
  return validateConfig(JSON.parse(json));
}
export function serializeConfig(scene) { return JSON.stringify(validateConfig(scene), null, 2) + '\n'; }
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
const normalizeAngle = (value) => ((value + 180) % 360 + 360) % 360 - 180;
export function basePlacements(config) {
  const scene = validateConfig(config);
  if (scene.mode === 'custom') return scene.placements;
  const random = seededRandom(scene.seed);
  const width = scene.symmetry === 'none' ? scene.width : scene.width / 2;
  const height = scene.symmetry === 'four' ? scene.height / 2 : scene.height;
  const cols = Math.max(1, Math.round(width / scene.spacing));
  const rows = Math.max(1, Math.round(height / scene.spacing));
  const cellW = width / cols, cellH = height / rows;
  const result = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const jitterX = (random() - .5) * Math.min(8, cellW * .08);
    const jitterY = (random() - .5) * Math.min(8, cellH * .08);
    result.push({ id: result.length + 1, type: scene.motif, x: (x + .5) * cellW + jitterX, y: (y + .5) * cellH + jitterY, size: scene.size, rotation: normalizeAngle(scene.rotation + (scene.motif === 'atlas' && y % 2 ? 180 : 0)) });
  }
  return result;
}
export function toCustomScene(config) {
  const scene = validateConfig(config);
  if (scene.mode === 'custom') return { scene, omitted: 0 };
  const placements = basePlacements(scene);
  return { scene: validateConfig({ ...scene, mode: 'custom', placements: placements.slice(0, 200) }), omitted: Math.max(0, placements.length - 200) };
}
export function insertPlacement(config, x, y) {
  const { scene } = toCustomScene(config);
  if (scene.placements.length >= 200) throw new RangeError('The scene already has 200 source motifs');
  number(x, 0, scene.width, 'X'); number(y, 0, scene.height, 'Y');
  const used = new Set(scene.placements.map((item) => item.id));
  let id = 1; while (used.has(id)) id++;
  scene.placements.push({ id, type: scene.motif, x, y, size: scene.size, rotation: scene.rotation });
  return { scene: validateConfig(scene), id };
}
export function nudgePlacement(config, id, dx, dy, { flipX = false, flipY = false } = {}) {
  const scene = validateConfig(config), item = scene.placements.find((placement) => placement.id === id);
  if (!item) fail('Unknown motif placement');
  number(dx, -2048, 2048, 'Horizontal movement'); number(dy, -2048, 2048, 'Vertical movement');
  item.x = Math.max(0, Math.min(scene.width, item.x + dx * (flipX ? -1 : 1)));
  item.y = Math.max(0, Math.min(scene.height, item.y + dy * (flipY ? -1 : 1)));
  return scene;
}
export function instances(config) {
  const scene = validateConfig(config), output = [];
  for (const item of basePlacements(scene)) {
    output.push({ ...item, flipX: false, flipY: false });
    if (scene.symmetry !== 'none') output.push({ ...item, x: scene.width - item.x, flipX: true, flipY: false });
    if (scene.symmetry === 'four') {
      output.push({ ...item, y: scene.height - item.y, flipX: false, flipY: true });
      output.push({ ...item, x: scene.width - item.x, y: scene.height - item.y, flipX: true, flipY: true });
    }
  }
  return output;
}
function motif(type, c) {
  const outline = `fill="none" stroke="${c.thread}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
  if (type === 'almond') return `<g ${outline}><path d="M0-43C-35-17-29 28 0 44C29 28 35-17 0-43Z"/><path d="M0-31C-23-9-19 20 0 32C19 20 23-9 0-31Z" stroke="${c.trim}"/><path d="M0 27C-19 6 18-3 0-23M-1 13-13 5M3-5 13-12" stroke="${c.detail}"/><circle cx="0" cy="0" r="3" fill="${c.trim}" stroke="none"/></g>`;
  if (type === 'rosette') return `<g ${outline}>${Array.from({length: 8}, (_, i) => `<path transform="rotate(${i * 45})" d="M0-5C-18-20-11-38 0-42C11-38 18-20 0-5Z"/>`).join('')}<circle r="12" fill="${c.cloth}" stroke="${c.trim}"/><path d="m0-7 7 7-7 7-7-7Z" fill="${c.detail}" stroke="none"/></g>`;
  return `<g ${outline}><path d="M0-44 9-27 16-31 18-12 26-16 30 2 17 11 15 29 8 26 0 44-8 26-15 29-17 11-30 2-26-16-18-12-16-31-9-27Z" fill="${c.detail}" stroke="${c.trim}"/><path d="M0-25 15 0 0 26-15 0Z" fill="${c.cloth}"/><path d="m0-13 7 13-7 14-7-14Z" fill="${c.thread}" stroke="none"/></g>`;
}
const rounded = (value) => Math.round(value * 1000) / 1000;
export function createSVG(config, { editor = false, selected = null, grid = false } = {}) {
  const scene = validateConfig(config), c = scene.palette;
  const shapes = instances(scene).map((item) => {
    const attrs = editor && scene.mode === 'custom' ? ` data-id="${item.id}" data-flip-x="${item.flipX}" data-flip-y="${item.flipY}" tabindex="0" role="button" aria-label="نەقىش ${item.id}"` : '';
    const selection = editor && selected === item.id && scene.mode === 'custom' ? '<rect class="selection-box" x="-49" y="-49" width="98" height="98" rx="5" fill="none" stroke="#83d5ff" stroke-width="1.7" stroke-dasharray="4 3"/>' : '';
    return `<g${attrs} transform="translate(${rounded(item.x)} ${rounded(item.y)}) scale(${item.flipX ? -1 : 1} ${item.flipY ? -1 : 1}) rotate(${rounded(item.rotation)}) scale(${rounded(item.size / 100)})">${motif(item.type, c)}${selection}</g>`;
  }).join('');
  const guide = editor && grid ? `<defs><pattern id="studio-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r=".7" fill="${c.thread}" opacity=".18"/></pattern></defs><rect width="100%" height="100%" fill="url(#studio-grid)" pointer-events="none"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" role="${editor ? 'group' : 'img'}" aria-label="دوپپا ئىلھامىدىكى نەقىش"><title>دوپپا ئىلھامىدىكى نەقىش</title><rect width="100%" height="100%" fill="${c.cloth}"/>${guide}${shapes}</svg>`;
}
export function createRasterExport(config, scale = 2) {
  choice(scale, [1, 2], 'PNG scale');
  const scene = validateConfig(config);
  return { svg: createSVG(scene), width: scene.width * scale, height: scene.height * scale };
}
export function createHistory(initial = DEFAULTS, limit = 60) {
  if (!Number.isInteger(limit) || limit < 1) fail('History limit must be a positive integer');
  let entries = [validateConfig(initial)], index = 0;
  return {
    get current() { return clone(entries[index]); },
    get canUndo() { return index > 0; }, get canRedo() { return index < entries.length - 1; },
    commit(next) {
      const value = validateConfig(next);
      if (JSON.stringify(value) === JSON.stringify(entries[index])) return false;
      entries = entries.slice(0, index + 1); entries.push(value);
      if (entries.length > limit) entries.shift(); index = entries.length - 1; return true;
    },
    undo() { if (index > 0) index--; return this.current; },
    redo() { if (index < entries.length - 1) index++; return this.current; },
  };
}
export function preset(name) {
  const choices = {
    midnight: { ...DEFAULTS, seed: 24 },
    garden: { ...DEFAULTS, motif: 'rosette', palette: PALETTES.garden, spacing: 144, size: 94, symmetry: 'four', seed: 71 },
    atlas: { ...DEFAULTS, motif: 'atlas', palette: PALETTES.pomegranate, spacing: 96, size: 86, symmetry: 'mirror', seed: 108 },
    porcelain: { ...DEFAULTS, motif: 'almond', palette: PALETTES.porcelain, rotation: 35, spacing: 108, size: 74, seed: 39 },
  };
  if (!Object.hasOwn(choices, name)) fail('Unknown preset');
  return validateConfig(choices[name]);
}
