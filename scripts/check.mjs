// Self-check for stroke matching and profile logic: node scripts/check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePath, judge, detectType, taperedOutline, trimCurl } from '../src/strokes.ts';
import { sanitize, addAttempt, median, DEFAULT_PROFILE } from '../src/profile.ts';

const data = JSON.parse(readFileSync(new URL('../src/hiragana.json', import.meta.url)));
for (const { kana, strokes } of data) {
  const refs = strokes.map((s) => parsePath(s.d));
  refs.forEach((r, i) => {
    assert.ok(r.every((p) => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1), `${kana} ${i} out of box`);
    assert.equal(judge(r, refs, i, 0.1).error, undefined, `${kana} stroke ${i} should match itself`);
    const shifted = r.map((p) => ({ x: p.x + 0.2, y: p.y }));
    assert.ok(judge(shifted, refs, i, 0.1).error, `${kana} stroke ${i} shifted should fail`);
    const span = Math.hypot(r[0].x - r.at(-1).x, r[0].y - r.at(-1).y);
    if (span > 0.25) assert.ok(judge([...r].reverse(), refs, i, 0.1).error, `${kana} stroke ${i} reversed should fail`);
  });
}

// Timed strokes: straight line that stops (tome), keeps going (harai), hooks back (hane).
const line = (n) => Array.from({ length: n }, (_, i) => ({ x: 0.2, y: 0.2 + (0.6 * i) / (n - 1), t: (i * 500) / (n - 1) }));
assert.equal(detectType(line(20), 700), 'tome'); // last move at t=500, lifted at 700
assert.equal(detectType(line(20), 500), 'harai');
const hook = [...line(20), { x: 0.17, y: 0.78, t: 510 }, { x: 0.14, y: 0.76, t: 520 }];
assert.equal(detectType(hook, 520), 'hane');

// trimCurl: a dot that curls back loses the curl; a long stroke ending in a loop is untouched.
const dot = [{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.25 }, { x: 0.35, y: 0.3 }, { x: 0.3, y: 0.32 }];
assert.equal(trimCurl(dot).length, 3);
const loop = [...line(20), { x: 0.8, y: 0.8 }, { x: 0.8, y: 0.6 }, { x: 0.7, y: 0.7 }];
assert.equal(trimCurl(loop).length, loop.length);

// Harai outline: full width at the start, a point at the end.
const outline = taperedOutline(line(20), 0.05);
const w = (a, b) => Math.hypot(outline[a].x - outline[b].x, outline[a].y - outline[b].y);
assert.ok(Math.abs(w(0, outline.length - 1) - 0.05) < 1e-9);
assert.ok(w(39, 40) < 1e-9);

// Profile
let p = DEFAULT_PROFILE;
for (let i = 0; i < 25; i++) p = addAttempt(p, 'あ', { t: i, correctness: 1, precision: 0.5 });
assert.equal(p.history['あ'].length, 20);
assert.equal(p.history['あ'][0].t, 5);
assert.deepEqual(sanitize(JSON.parse(JSON.stringify(p))), p);
assert.throws(() => sanitize({ settings: { detection: 'x', tolerance: 0.1 }, history: {} }));
assert.deepEqual(sanitize({ settings: { detection: 'auto', tolerance: 0.1 }, history: {} }).settings, { detection: 'auto', tolerance: 0.1, rows: [], shuffle: true, theme: 'system' });
assert.throws(() => sanitize({ settings: { detection: 'auto', tolerance: 0.1, theme: 'blue' }, history: {} }));
assert.throws(() => sanitize({ settings: { detection: 'auto', tolerance: 0.1, shuffle: 'yes' }, history: {} }));
assert.deepEqual(sanitize({ settings: { detection: 'auto', tolerance: 0.1, rows: ['さ', 'か'] }, history: {} }).settings.rows, ['か', 'さ']);
assert.throws(() => sanitize({ settings: { detection: 'auto', tolerance: 0.1, rows: ['x'] }, history: {} }));
assert.throws(() => sanitize({ ...p, history: { あ: [{ t: 1, correctness: 2, precision: 0 }] } }));
assert.equal(median([3, 1, 2]), 2);
assert.equal(median([1, 2, 3, 4]), 2.5);
assert.equal(median([]), undefined);
console.log('ok');
