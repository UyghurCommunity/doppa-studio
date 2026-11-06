import { DEFAULTS, PALETTES, validateConfig, parseConfig, serializeConfig, createSVG, createHistory, preset, instances, toCustomScene, insertPlacement, nudgePlacement, createRasterExport } from './engine.js';

const $ = (id) => document.getElementById(id);
const all = (selector) => [...document.querySelectorAll(selector)];
const STORAGE_KEY = 'doppa-studio-scene-v1';
let scene = validateConfig(DEFAULTS);
try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) scene = parseConfig(saved); } catch { /* Invalid or unavailable local storage uses a clean scene. */ }
const history = createHistory(scene);
let selected = null, zoom = 1, showGrid = false, dragging = null, toastTimer, importRequest = 0;
const stage = $('artwork');
stage.tabIndex = -1;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionEnabled = !reducedMotion.matches;

function announce(message) {
  const toast = $('toast'); toast.textContent = message; toast.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}
function persist() { try { localStorage.setItem(STORAGE_KEY, serializeConfig(scene)); } catch { /* Saving files is always available without local storage. */ } }
function commit(next = scene) {
  scene = validateConfig(next); history.commit(scene); persist(); render();
}
function selectedItem() { return scene.placements.find((item) => item.id === selected); }
function currentSize() { return selectedItem()?.size ?? scene.size; }
function currentRotation() { return selectedItem()?.rotation ?? scene.rotation; }
function focusMotif(id, flipX = 'false', flipY = 'false') {
  const node = stage.querySelector(`g[data-id="${id}"][data-flip-x="${flipX}"][data-flip-y="${flipY}"]`);
  (node || stage).focus({ preventScroll: true });
}
function renderArtwork() {
  const active = document.activeElement?.closest?.('g[data-id]');
  const focus = active && stage.contains(active) ? { ...active.dataset } : null;
  stage.innerHTML = createSVG(scene, { editor: true, selected, grid: showGrid });
  if (focus) focusMotif(Number(focus.id), focus.flipX, focus.flipY);
  stage.dataset.custom = String(scene.mode === 'custom');
  $('motif-count').textContent = `${instances(scene).length} نەقىش`;
  $('scene-mode').textContent = scene.mode === 'repeat' ? 'تەكرار نەقىش' : 'ئەركىن ئورۇنلاشتۇرۇش';
  $('canvas-hint').textContent = scene.mode === 'repeat' ? 'تەڭشەكلەرنى ئۆزگەرتىپ نەتىجىنى دەرھال كۆرۈڭ.' : selected ? 'تاللانغان نەقىشنى تارتىپ يۆتكەڭ؛ ئۆچۈرۈش كۇنۇپكىسىمۇ ئىشلىتىلىدۇ.' : 'بوش ئورۇننى چېكىپ نەقىش قوشۇڭ، ياكى بار نەقىشنى تاللاڭ.';
  $('delete-motif').disabled = !selectedItem();
}
function render() {
  if (selected && !selectedItem()) selected = null;
  renderArtwork();
  all('[data-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === scene.mode)));
  all('[data-motif]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.motif === (selectedItem()?.type ?? scene.motif))));
  all('[data-symmetry]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.symmetry === scene.symmetry)));
  all('[data-palette]').forEach((button) => button.setAttribute('aria-pressed', String(JSON.stringify(PALETTES[button.dataset.palette]) === JSON.stringify(scene.palette))));
  all('[data-color]').forEach((input) => { input.value = scene.palette[input.dataset.color]; });
  $('mode-hint').textContent = scene.mode === 'repeat' ? 'بىر شەكىلدىن پۈتۈن بىر رەسىم ھاسىل قىلىڭ.' : 'نەقىشلەرنى چېكىپ تاللاڭ، تارتىپ يۆتكەڭ؛ ئەينەك تەرەپمۇ تەڭ ئۆزگىرىدۇ.';
  for (const key of ['spacing', 'size', 'rotation']) {
    const value = key === 'size' ? currentSize() : key === 'rotation' ? currentRotation() : scene.spacing;
    $(key).value = value; $(`${key}-value`).value = `${value}${key === 'rotation' ? '°' : ' px'}`;
  }
  $('spacing').disabled = scene.mode === 'custom';
  $('seed').value = scene.seed; $('seed').disabled = scene.mode === 'custom'; $('shuffle').disabled = scene.mode === 'custom';
  const dimensions = `${scene.width}x${scene.height}`;
  $('dimensions').value = ['960x720', '900x900', '720x960'].includes(dimensions) ? dimensions : 'custom';
  $('undo').disabled = !history.canUndo; $('redo').disabled = !history.canRedo;
}

function addAt(x, y) {
  try {
    const result = insertPlacement(scene, x, y); selected = result.id; commit(result.scene);
  } catch (error) {
    announce(error instanceof RangeError ? 'ئەڭ كۆپ 200 نەقىش قوشقىلى بولىدۇ. قوشۇش ئۈچۈن بىر نەقىشنى ئۆچۈرۈڭ ياكى سەھنىنى تازىلاڭ.' : 'بۇ ئورۇنغا نەقىش قوشقىلى بولمىدى.');
  }
}
function removeSelected() {
  if (!selectedItem()) return;
  scene.placements = scene.placements.filter((item) => item.id !== selected); selected = null; commit();
}
all('[data-mode]').forEach((button) => button.addEventListener('click', () => {
  selected = null;
  if (button.dataset.mode === 'custom') {
    const converted = toCustomScene(scene); commit(converted.scene);
    if (converted.omitted) announce(`تەھرىرلەش چېكى سەۋەبىدىن دەسلەپكى 200 نەقىش ساقلاپ قېلىندى؛ ${converted.omitted} نەقىش كىرگۈزۈلمىدى. ئالدىنقى ھالەتكە قايتقىلى بولىدۇ.`);
  } else commit({ ...scene, mode: 'repeat' });
}));
all('[data-motif]').forEach((button) => button.addEventListener('click', () => {
  scene.motif = button.dataset.motif;
  if (selectedItem()) selectedItem().type = scene.motif;
  commit();
}));
all('[data-symmetry]').forEach((button) => button.addEventListener('click', () => { scene.symmetry = button.dataset.symmetry; commit(); }));
all('[data-palette]').forEach((button) => button.addEventListener('click', () => { scene.palette = { ...PALETTES[button.dataset.palette] }; commit(); }));
all('[data-color]').forEach((input) => {
  input.addEventListener('input', () => { scene.palette[input.dataset.color] = input.value; renderArtwork(); });
  input.addEventListener('change', () => commit());
});
for (const key of ['spacing', 'size', 'rotation']) {
  $(key).addEventListener('input', (event) => {
    const value = Number(event.target.value); scene[key] = value;
    if (key !== 'spacing' && selectedItem()) selectedItem()[key] = value;
    $(`${key}-value`).value = `${value}${key === 'rotation' ? '°' : ' px'}`;
    renderArtwork();
  });
  $(key).addEventListener('change', () => commit());
}
$('seed').addEventListener('change', () => {
  const value = Number($('seed').value);
  if (!Number.isInteger(value) || value < 0 || value > 999999) { $('seed').value = scene.seed; announce('ئۇرۇق 0 دىن 999999 غىچە بولغان پۈتۈن سان بولۇشى كېرەك.'); return; }
  scene.seed = value; commit();
});
$('shuffle').addEventListener('click', () => { const random = new Uint32Array(1); crypto.getRandomValues(random); scene.seed = random[0] % 1000000; commit(); });
$('dimensions').addEventListener('change', () => {
  if ($('dimensions').value === 'custom') return;
  const [width, height] = $('dimensions').value.split('x').map(Number);
  scene.placements = scene.placements.map((item) => ({ ...item, x: item.x / scene.width * width, y: item.y / scene.height * height }));
  scene.width = width; scene.height = height; commit();
});
$('add-motif').addEventListener('click', () => addAt(scene.width * .3, scene.height * .4));
$('delete-motif').addEventListener('click', removeSelected);
$('clear-scene').addEventListener('click', () => { selected = null; commit({ ...scene, mode: 'custom', placements: [] }); announce('سەھنە تازىلاندى. ئالدىنقى ھالەتكە قايتقىلى بولىدۇ.'); });
$('reset').addEventListener('click', () => { selected = null; commit(DEFAULTS); setZoom(1); announce('دەسلەپكى لايىھە ئەسلىگە كەلدى.'); });
function undo() { scene = history.undo(); selected = null; persist(); render(); }
function redo() { scene = history.redo(); selected = null; persist(); render(); }
$('undo').addEventListener('click', undo); $('redo').addEventListener('click', redo);

function stagePoint(event) {
  const svg = stage.querySelector('svg'), matrix = svg?.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: Math.max(0, Math.min(scene.width, point.x)), y: Math.max(0, Math.min(scene.height, point.y)) };
}
stage.addEventListener('pointerdown', (event) => {
  if (scene.mode !== 'custom' || event.button !== 0 || dragging) return;
  const point = stagePoint(event); if (!point) return;
  const target = event.target.closest('g[data-id]');
  if (!target) { addAt(point.x, point.y); return; }
  event.preventDefault(); selected = Number(target.dataset.id);
  const item = selectedItem(); if (!item) return;
  const flipX = target.dataset.flipX === 'true', flipY = target.dataset.flipY === 'true';
  const sourceX = flipX ? scene.width - point.x : point.x, sourceY = flipY ? scene.height - point.y : point.y;
  dragging = { id: event.pointerId, startX: item.x, startY: item.y, pointX: sourceX, pointY: sourceY, flipX, flipY, before: validateConfig(scene) };
  stage.setPointerCapture(event.pointerId); stage.classList.add('dragging'); render();
  focusMotif(selected, String(flipX), String(flipY));
});
stage.addEventListener('pointermove', (event) => {
  if (!dragging || event.pointerId !== dragging.id) return;
  const point = stagePoint(event), item = selectedItem(); if (!point || !item) return;
  const x = dragging.flipX ? scene.width - point.x : point.x, y = dragging.flipY ? scene.height - point.y : point.y;
  item.x = Math.max(0, Math.min(scene.width, dragging.startX + x - dragging.pointX));
  item.y = Math.max(0, Math.min(scene.height, dragging.startY + y - dragging.pointY));
  renderArtwork();
});
function finishDrag(event) {
  if (!dragging || event.pointerId !== dragging.id) return;
  if (event.type === 'pointercancel') { cancelDrag(); return; }
  dragging = null; stage.classList.remove('dragging');
  if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  commit();
}
function cancelDrag() {
  if (!dragging) return;
  const { id, before } = dragging; dragging = null; scene = before;
  stage.classList.remove('dragging');
  if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
  render();
}
stage.addEventListener('pointerup', finishDrag); stage.addEventListener('pointercancel', finishDrag); stage.addEventListener('lostpointercapture', finishDrag);
stage.addEventListener('keydown', (event) => {
  const target = event.target.closest('g[data-id]');
  if (target && ['Enter', ' '].includes(event.key)) { event.preventDefault(); selected = Number(target.dataset.id); render(); return; }
  if (target && (event.key.startsWith('Arrow') || ['Delete', 'Backspace'].includes(event.key))) selected = Number(target.dataset.id);
});
document.addEventListener('keydown', (event) => {
  if (event.target.closest('input,select,textarea,[contenteditable=true]')) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); cancelDrag(); event.shiftKey ? redo() : undo(); return; }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); cancelDrag(); redo(); return; }
  if (event.key === 'Escape') { if (dragging) cancelDrag(); else { selected = null; render(); } return; }
  if (dragging || event.altKey || event.ctrlKey || event.metaKey) return;
  if (['Delete', 'Backspace'].includes(event.key) && selectedItem()) { event.preventDefault(); removeSelected(); return; }
  const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (delta && selectedItem()) {
    event.preventDefault(); const step = event.shiftKey ? 10 : 1, target = event.target.closest('g[data-id]');
    commit(nudgePlacement(scene, selected, delta[0] * step, delta[1] * step, { flipX: target?.dataset.flipX === 'true', flipY: target?.dataset.flipY === 'true' }));
  }
});
function setZoom(value) {
  zoom = Math.max(.5, Math.min(2, Math.round(value * 10) / 10));
  stage.style.width = `${zoom * 100}%`; stage.style.maxWidth = `${820 * zoom}px`;
  $('canvas-area').style.justifyContent = zoom > 1 ? 'flex-start' : 'center';
  $('zoom-value').value = `${Math.round(zoom * 100)}%`;
  $('zoom-out').disabled = zoom <= .5; $('zoom-in').disabled = zoom >= 2;
}
$('zoom-out').addEventListener('click', () => setZoom(zoom - .1)); $('zoom-in').addEventListener('click', () => setZoom(zoom + .1)); $('fit').addEventListener('click', () => setZoom(1));
$('grid-toggle').addEventListener('click', () => { showGrid = !showGrid; $('grid-toggle').setAttribute('aria-pressed', String(showGrid)); renderArtwork(); });

function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
$('export-svg').addEventListener('click', () => { download(new Blob([createSVG(scene)], { type: 'image/svg+xml;charset=utf-8' }), 'doppa-pattern.svg'); announce('نەقىش SVG قىلىپ چۈشۈرۈلدى.'); });
$('export-png').addEventListener('click', async () => {
  const button = $('export-png'); button.disabled = true;
  let url;
  try {
    // Freeze the SVG and dimensions together before decoding. Editing the scene
    // while decoding must not change the aspect ratio of this export.
    const output = createRasterExport(scene, Number($('png-scale').value));
    url = URL.createObjectURL(new Blob([output.svg], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = output.width; canvas.height = output.height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png'));
    download(blob, 'doppa-pattern.png'); announce('نەقىش PNG قىلىپ چۈشۈرۈلدى.');
  } catch { announce('PNG ھاسىل بولمىدى. SVG نى چۈشۈرۈپ سىناڭ.'); }
  finally { if (url) URL.revokeObjectURL(url); button.disabled = false; }
});
$('save-json').addEventListener('click', () => { download(new Blob([serializeConfig(scene)], { type: 'application/json' }), 'doppa-scene.json'); announce('تەھرىرلىگىلى بولىدىغان لايىھە ساقلىنىلدى.'); });
$('load-json').addEventListener('click', () => $('scene-file').click());
$('scene-file').addEventListener('change', async (event) => {
  const file = event.target.files[0]; if (!file) return;
  const request = ++importRequest;
  try { if (file.size > 250000) throw new Error('Too large'); const imported = parseConfig(await file.text()); if (request !== importRequest) return; cancelDrag(); selected = null; commit(imported); setZoom(1); announce('لايىھە مۇۋەپپەقىيەتلىك ئېچىلدى.'); }
  catch { if (request === importRequest) announce('بۇ لايىھە ھۆججىتى ئىناۋەتسىز. توغرا JSON ھۆججىتىنى تاللاڭ.'); }
  finally { if (request === importRequest) event.target.value = ''; }
});
$('copy-svg').addEventListener('click', async () => {
  const svg = createSVG(scene);
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(svg);
    else {
      const input = document.createElement('textarea'); input.value = svg; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.appendChild(input); input.select(); const copied = document.execCommand('copy'); input.remove(); if (!copied) throw new Error('Copy denied');
    }
    announce('SVG كودى كۆچۈرۈلدى؛ HTML بەت ئىچىگە چاپلىيالايسىز.');
  } catch { announce('كۆچۈرگىلى بولمىدى. SVG ھۆججىتىنى چۈشۈرەلەيسىز.'); }
});
all('[data-preset]').forEach((button) => {
  button.querySelector('.preset-preview').innerHTML = createSVG(preset(button.dataset.preset));
  button.addEventListener('click', () => { selected = null; commit(preset(button.dataset.preset)); setZoom(1); announce('تەييار لايىھە ئېچىلدى؛ ھازىر ئۆزگەرتەلەيسىز.'); });
});
all('[data-motif]').forEach((button) => {
  const preview = validateConfig({ width: 240, height: 240, mode: 'custom', symmetry: 'none', placements: [{ id: 1, type: button.dataset.motif, x: 120, y: 120, size: 180, rotation: 0 }] });
  button.querySelector('.motif-preview').innerHTML = createSVG(preview);
});
all('[data-palette]').forEach((button) => { const colors = Object.values(PALETTES[button.dataset.palette]); button.style.background = `conic-gradient(${colors.map((color, i) => `${color} ${i * 25}% ${(i + 1) * 25}%`).join(',')})`; });
function syncMotion() {
  const running = motionEnabled && !reducedMotion.matches && !document.hidden;
  document.documentElement.dataset.motion = running ? 'running' : 'paused';
  $('motion-toggle').setAttribute('aria-pressed', String(running));
  $('motion-toggle').innerHTML = `ھەرىكەت <span aria-hidden="true">${running ? 'Ⅱ' : '▷'}</span>`;
  $('motion-toggle').title = reducedMotion.matches ? 'سىستېمىدىكى ھەرىكەتنى ئازايتىش تەڭشىكىگە ئەمەل قىلىنىدۇ' : running ? 'زىننەت ھەرىكىتىنى توختىتىش' : 'زىننەت ھەرىكىتىنى داۋاملاشتۇرۇش';
}
$('motion-toggle').addEventListener('click', () => { if (reducedMotion.matches) { announce('سىستېمىڭىزدىكى ھەرىكەتنى ئازايتىش تەڭشىكى ئوچۇق.'); return; } motionEnabled = !motionEnabled; syncMotion(); });
reducedMotion.addEventListener('change', syncMotion); document.addEventListener('visibilitychange', () => { if (document.hidden) cancelDrag(); syncMotion(); });
render(); setZoom(1); syncMotion();
