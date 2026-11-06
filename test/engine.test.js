import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, PALETTES, validateConfig, parseConfig, serializeConfig, basePlacements, instances, createSVG, createHistory, preset, toCustomScene, insertPlacement, nudgePlacement, createRasterExport } from '../engine.js';

test('seeded patterns reproduce exactly and seeds affect their layout', () => {
  const scene = validateConfig(DEFAULTS);
  assert.equal(createSVG(scene), createSVG(parseConfig(serializeConfig(scene))));
  assert.notEqual(createSVG(scene), createSVG({ ...scene, seed: scene.seed + 1 }));
  for (const placement of basePlacements(scene)) {
    assert(placement.x >= 0 && placement.x <= scene.width / 2);
    assert(placement.y >= 0 && placement.y <= scene.height);
  }
});
test('mirrors reflect positions and preserve source IDs without changing input', () => {
  const scene = validateConfig({ mode: 'custom', symmetry: 'four', placements: [{ id: 7, type: 'almond', x: 123, y: 86, size: 60, rotation: 32 }] });
  const before = serializeConfig(scene), copies = instances(scene);
  assert.equal(copies.length, 4); assert(copies.every((item) => item.id === 7));
  assert.deepEqual(copies.map(({ x, y }) => [x, y]), [[123, 86], [837, 86], [123, 634], [837, 634]]);
  assert.equal(serializeConfig(scene), before);
});
test('SVG exports use paths only with no editor controls or remote resources', () => {
  for (const motif of ['almond', 'rosette', 'atlas']) {
    const svg = createSVG({ motif });
    assert(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert(svg.includes('<path'));
    assert(!/<(?:script|image|text|foreignObject|style)\b/i.test(svg));
    assert(!/href=|onload=|data-id=|tabindex=|selection-box|studio-grid|@font-face/.test(svg));
  }
  const scene = validateConfig({ mode: 'custom', placements: [{ id: 1, type: 'rosette', x: 200, y: 200, size: 80, rotation: 0 }] });
  assert(createSVG(scene, { editor: true, grid: true, selected: 1 }).includes('selection-box'));
  assert(!createSVG(scene).includes('selection-box'));
});
test('untrusted JSON cannot introduce markup or unknown objects', () => {
  const malicious = [
    { palette: { cloth: '"><script>alert(1)</script>' } },
    { motif: '<image href="https://example.com">' },
    { onload: 'alert(1)' }, { version: 9 }, { width: 10000 }, { height: NaN },
    { symmetry: 'radial' }, { seed: .5 }, { size: 181 }, { spacing: 1 },
    { placements: [{ id: 1, type: 'almond', x: -1, y: 0, size: 50, rotation: 0 }] },
    { placements: [{ id: 1, type: 'almond', x: 0, y: 0, size: 50, rotation: 0, onclick: 'bad' }] },
  ];
  malicious.forEach((input) => assert.throws(() => validateConfig(input), TypeError));
  assert.throws(() => parseConfig('{"__proto__":{"polluted":true}}'), TypeError);
  assert.throws(() => parseConfig('x'.repeat(250001)), TypeError);
  assert.equal({}.polluted, undefined);
});
test('placement IDs and count are bounded; scenes clone caller data', () => {
  const placement = { id: 1, type: 'atlas', x: 1, y: 1, size: 50, rotation: 0 };
  assert.throws(() => validateConfig({ placements: [placement, placement] }), /Duplicate/);
  assert.throws(() => validateConfig({ placements: Array.from({ length: 201 }, (_, i) => ({ ...placement, id: i + 1 })) }), /200/);
  const scene = validateConfig({ palette: PALETTES.garden, placements: [placement] });
  scene.palette.cloth = '#ffffff'; scene.placements[0].x = 25;
  assert.equal(PALETTES.garden.cloth, '#173c33'); assert.equal(placement.x, 1);
});
test('undo/redo restores complete exports and new changes discard redo history', () => {
  const history = createHistory();
  const first = createSVG(history.current);
  history.commit(preset('garden')); const second = createSVG(history.current);
  assert.notEqual(first, second); assert.equal(createSVG(history.undo()), first);
  assert.equal(createSVG(history.redo()), second);
  history.undo(); history.commit(preset('atlas')); assert.equal(history.canRedo, false);
  const snapshot = history.current; snapshot.size = 10;
  assert.notEqual(history.current.size, 10);
});
test('history bound retains newest changes and rejects invalid commits', () => {
  const history = createHistory(DEFAULTS, 3);
  for (let seed = 1; seed <= 5; seed++) history.commit({ ...history.current, seed });
  assert.equal(history.undo().seed, 4); assert.equal(history.undo().seed, 3); assert.equal(history.canUndo, false);
  assert.throws(() => history.commit({ ...history.current, width: -1 }));
  assert.equal(history.current.seed, 3);
});
test('presets are independently editable and reusable JSON round trips', () => {
  for (const name of ['midnight', 'garden', 'atlas', 'porcelain']) {
    const scene = preset(name), restored = parseConfig(serializeConfig(scene));
    assert.deepEqual(restored, scene); assert(createSVG(scene).length > 1000);
  }
  assert.throws(() => preset('__proto__'), /Unknown/);
  const one = preset('garden'); one.palette.cloth = '#000000';
  assert.notEqual(preset('garden').palette.cloth, one.palette.cloth);
});
test('alternating atlas rows stay valid and convert to editable scenes without changing the artwork', () => {
  for (const rotation of [-180, -45, 0, 135, 180]) {
    const repeat = validateConfig({ ...preset('atlas'), rotation });
    const generated = basePlacements(repeat);
    assert(generated.every((item) => item.rotation >= -180 && item.rotation <= 180));
    const converted = toCustomScene(repeat);
    assert.equal(converted.omitted, 0);
    assert.equal(createSVG(converted.scene), createSVG(repeat));
    assert.deepEqual(parseConfig(serializeConfig(converted.scene)), converted.scene);
  }
});
test('dense conversion reports omitted motifs; a failed insert never changes the original mode or scene', () => {
  const repeat = validateConfig({ width: 2048, height: 2048, spacing: 48, motif: 'atlas', rotation: 160, symmetry: 'none' });
  const before = serializeConfig(repeat), converted = toCustomScene(repeat);
  assert.equal(converted.scene.placements.length, 200);
  assert.equal(converted.omitted, basePlacements(repeat).length - 200);
  assert.throws(() => insertPlacement(repeat, 100, 100), /200/);
  assert.equal(serializeConfig(repeat), before);
  assert.equal(repeat.mode, 'repeat');
  assert.deepEqual(parseConfig(serializeConfig(converted.scene)), converted.scene);
});
test('inserting into an imported scene reuses an available ID even when another motif has the maximum ID', () => {
  const imported = validateConfig({ mode: 'custom', placements: [{ id: 1000000, type: 'almond', x: 50, y: 50, size: 70, rotation: 0 }] });
  const { scene, id } = insertPlacement(imported, 120, 160);
  assert.equal(id, 1); assert.equal(scene.placements.length, 2);
  assert.equal(imported.placements.length, 1);
  assert.throws(() => insertPlacement(imported, NaN, 10));
  assert.throws(() => insertPlacement(imported, 961, 10));
});
test('keyboard nudges follow the visible direction of reflected motifs and clamp at canvas edges', () => {
  const original = validateConfig({ mode: 'custom', symmetry: 'four', placements: [{ id: 1, type: 'rosette', x: 123, y: 86, size: 60, rotation: 0 }] });
  const moved = nudgePlacement(original, 1, 10, 10, { flipX: true, flipY: true });
  const before = instances(original).find((item) => item.flipX && item.flipY), after = instances(moved).find((item) => item.flipX && item.flipY);
  assert.equal(after.x - before.x, 10); assert.equal(after.y - before.y, 10);
  assert.equal(original.placements[0].x, 123);
  const bounded = nudgePlacement(original, 1, -2048, 2048);
  assert.equal(bounded.placements[0].x, 0); assert.equal(bounded.placements[0].y, original.height);
});
test('PNG export snapshots keep SVG, size, and scale consistent while the editor changes', () => {
  const scene = validateConfig({ width: 720, height: 960 }), output = createRasterExport(scene, 2);
  scene.width = 960; scene.height = 720; scene.palette.cloth = '#ffffff';
  assert.equal(output.width, 1440); assert.equal(output.height, 1920);
  assert(output.svg.includes('width="720" height="960"'));
  assert(output.svg.includes('#102d3d')); assert(!output.svg.includes('#ffffff'));
  assert.equal(createRasterExport(scene, 1).width, 960);
  for (const scale of [0, 3, '2', NaN]) assert.throws(() => createRasterExport(scene, scale));
});
test('clear, reset, movement and JSON import remain reversible complete scene changes', () => {
  const history = createHistory(preset('atlas')), states = [serializeConfig(history.current)];
  const inserted = insertPlacement(history.current, 160, 120); history.commit(inserted.scene); states.push(serializeConfig(history.current));
  history.commit(nudgePlacement(history.current, inserted.id, 10, -10)); states.push(serializeConfig(history.current));
  history.commit({ ...history.current, mode: 'custom', placements: [] }); states.push(serializeConfig(history.current));
  history.commit(DEFAULTS); states.push(serializeConfig(history.current));
  history.commit(parseConfig(states[2])); states.push(serializeConfig(history.current));
  for (let index = states.length - 2; index >= 0; index--) assert.equal(serializeConfig(history.undo()), states[index]);
  for (let index = 1; index < states.length; index++) assert.equal(serializeConfig(history.redo()), states[index]);
  for (const limit of [0, -1, 1.5, '3']) assert.throws(() => createHistory(DEFAULTS, limit));
});
