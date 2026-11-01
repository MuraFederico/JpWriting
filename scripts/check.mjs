// Self-check for stroke matching and profile logic: node scripts/check.mjs
import assert from 'node:assert/strict';
import { judge, detectType, taperedOutline, hasHook } from '../src/strokes.ts';
import { sanitize, addAttempt, median, DEFAULT_PROFILE } from '../src/profile.ts';
import { KANA_DATA } from '../src/kana.ts';
import { deal, draw } from '../src/deck.ts';

for (const { kana, strokes } of KANA_DATA) {
  const refs = strokes.map((s) => s.pts);
  refs.forEach((r, i) => {
    // Hand-drawn hane strokes must end in a hook (so drawing them like the hint reads as hane), others must not.
    assert.equal(hasHook(r), strokes[i].type === 'hane', `${kana} stroke ${i + 1} (${strokes[i].type}) hook mismatch`);
    assert.ok(r.every((p) => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1), `${kana} ${i} out of box`);
    assert.equal(judge(r, refs, i, 0.1).error, undefined, `${kana} stroke ${i} should match itself`);
    const shifted = r.map((p) => ({ x: p.x + 0.2, y: p.y }));
    assert.ok(judge(shifted, refs, i, 0.1).error, `${kana} stroke ${i} shifted should fail`);
    const span = Math.hypot(r[0].x - r.at(-1).x, r[0].y - r.at(-1).y);
    if (span > 0.25) assert.ok(judge([...r].reverse(), refs, i, 0.1).error, `${kana} stroke ${i} reversed should fail`);
  });
}

// ぬ drawn for ね (and vice versa) is rejected even at the most lenient setting.
const kanaRefs = (k) => KANA_DATA.find((x) => x.kana === k).strokes.map((s) => s.pts);
for (const [drawn, target] of [['ぬ', 'ね'], ['ね', 'ぬ'], ['れ', 'わ'], ['シ', 'ツ'], ['ツ', 'シ'], ['ソ', 'ン'], ['ン', 'ソ']]) {
  const [a, b] = [kanaRefs(drawn), kanaRefs(target)];
  assert.ok(a.some((p, i) => judge(p, b, i, 0.2).error), `${drawn} should not pass as ${target}`);
}

// Timed strokes: straight line that stops (tome), keeps going (harai), hooks back (hane).
const line = (n) => Array.from({ length: n }, (_, i) => ({ x: 0.2, y: 0.2 + (0.6 * i) / (n - 1), t: (i * 500) / (n - 1) }));
assert.equal(detectType(line(20), 700), 'tome'); // last move at t=500, lifted at 700
assert.equal(detectType(line(20), 500), 'harai');
const hook = [...line(20), { x: 0.17, y: 0.78, t: 510 }, { x: 0.14, y: 0.76, t: 520 }];
assert.equal(detectType(hook, 520), 'hane');

// Long fast stroke, a pause, then a short quick flick up-right (に's 1st stroke) = hane.
const longHane = [...line(20), { x: 0.215, y: 0.785, t: 720 }, { x: 0.23, y: 0.77, t: 730 }];
assert.equal(detectType(longHane, 735), 'hane');

// hasHook ignores a tiny jitter at the end; a real flick counts.
assert.equal(detectType([...line(20), { x: 0.205, y: 0.795, t: 505 }], 505), 'harai');

// Harai outline: full width at the start, a point at the end.
const outline = taperedOutline(line(20), 0.05);
const w = (a, b) => Math.hypot(outline[a].x - outline[b].x, outline[a].y - outline[b].y);
assert.ok(Math.abs(w(0, outline.length - 1) - 0.05) < 1e-9);
assert.ok(w(39, 40) < 1e-9);

// Deck: every kana of the pool once before any repeats, and no repeat across the reshuffle.
{
  const pool = [3, 5, 8, 13, 21, 34];
  for (let run = 0; run < 50; run++) {
    let deck = deal(pool, true);
    let current = deck[0];
    const seen = [current];
    for (let k = 0; k < pool.length * 3 - 1; k++) {
      const prev = current;
      ({ deck, next: current } = draw(deck, current, pool, true));
      assert.notEqual(current, prev);
      seen.push(current);
    }
    for (let r = 0; r < 3; r++) assert.deepEqual([...seen.slice(r * 6, r * 6 + 6)].sort((a, b) => a - b), pool);
  }
  assert.deepEqual(deal(pool, false), pool);
  assert.equal(draw(pool, 34, pool, false).next, 3); // in order, wrapping around
}

// Profile
let p = DEFAULT_PROFILE;
for (let i = 0; i < 25; i++) p = addAttempt(p, 'あ', { t: i, correctness: 1, precision: 0.5 });
assert.equal(p.history['あ'].length, 20);
assert.equal(p.history['あ'][0].t, 5);
assert.deepEqual(sanitize(JSON.parse(JSON.stringify(p))), p);
assert.throws(() => sanitize({ settings: { detection: 'x', tolerance: 0.1 }, history: {} }));
assert.deepEqual(sanitize({ settings: { detection: 'auto', tolerance: 0.1 }, history: {} }).settings, { detection: 'auto', tolerance: 0.1, rows: [], shuffle: true, theme: 'system', script: 'hiragana' });
assert.throws(() => sanitize({ settings: { detection: 'auto', tolerance: 0.1, script: 'kanji' }, history: {} }));
assert.throws(() => sanitize({ settings: { detection: 'auto', tolerance: 0.1, theme: 'blue' }, history: {} }));
assert.throws(() => sanitize({ settings: { detection: 'auto', tolerance: 0.1, shuffle: 'yes' }, history: {} }));
assert.deepEqual(sanitize({ settings: { detection: 'auto', tolerance: 0.1, rows: ['さ', 'か'] }, history: {} }).settings.rows, ['か', 'さ']);
assert.throws(() => sanitize({ settings: { detection: 'auto', tolerance: 0.1, rows: ['x'] }, history: {} }));
assert.throws(() => sanitize({ ...p, history: { あ: [{ t: 1, correctness: 2, precision: 0 }] } }));
assert.equal(median([3, 1, 2]), 2);
assert.equal(median([1, 2, 3, 4]), 2.5);
assert.equal(median([]), undefined);
console.log('ok');
