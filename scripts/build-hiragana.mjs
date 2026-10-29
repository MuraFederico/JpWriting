// Downloads hiragana stroke paths from KanjiVG (CC BY-SA 3.0, https://kanjivg.tagaini.net)
// and writes src/hiragana.json. Run once: node scripts/build-hiragana.mjs
import { writeFileSync } from 'node:fs';

// Stroke endings, one letter per stroke in KanjiVG order: t = tome, n = hane, r = harai.
// KanjiVG has no ending data for kana, so these are hand-labelled; some are debatable, edit freely.
const KANA = [
  ['あ', 'a', 'ttr'], ['い', 'i', 'nt'], ['う', 'u', 'tr'], ['え', 'e', 'tr'], ['お', 'o', 'trt'],
  ['か', 'ka', 'ntt'], ['き', 'ki', 'tttt'], ['く', 'ku', 't'], ['け', 'ke', 'ntr'], ['こ', 'ko', 'nt'],
  ['さ', 'sa', 'ttt'], ['し', 'shi', 'r'], ['す', 'su', 'tr'], ['せ', 'se', 'tnt'], ['そ', 'so', 'r'],
  ['た', 'ta', 'ttnt'], ['ち', 'chi', 'tr'], ['つ', 'tsu', 'r'], ['て', 'te', 't'], ['と', 'to', 'tt'],
  ['な', 'na', 'ttnr'], ['に', 'ni', 'nnt'], ['ぬ', 'nu', 'tt'], ['ね', 'ne', 'tt'], ['の', 'no', 'r'],
  ['は', 'ha', 'ntr'], ['ひ', 'hi', 't'], ['ふ', 'fu', 'tntt'], ['へ', 'he', 't'], ['ほ', 'ho', 'nttr'],
  ['ま', 'ma', 'ttr'], ['み', 'mi', 'tt'], ['む', 'mu', 'tnt'], ['め', 'me', 'tt'], ['も', 'mo', 'ntt'],
  ['や', 'ya', 'ntt'], ['ゆ', 'yu', 'nr'], ['よ', 'yo', 'tr'],
  ['ら', 'ra', 'tr'], ['り', 'ri', 'nr'], ['る', 'ru', 't'], ['れ', 're', 'tr'], ['ろ', 'ro', 'r'],
  ['わ', 'wa', 'tr'], ['を', 'wo', 'ttt'], ['ん', 'n', 'r'],
];
const TYPES = { t: 'tome', n: 'hane', r: 'harai' };

const out = [];
for (const [kana, romaji, endings] of KANA) {
  const code = kana.codePointAt(0).toString(16).padStart(5, '0');
  const svg = await (await fetch(`https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${code}.svg`)).text();
  const ds = [...svg.matchAll(/<path id="kvg:[^"]+-s\d+" d="([^"]+)"/g)].map((m) => m[1]);
  if (ds.length !== endings.length) throw new Error(`${kana}: KanjiVG has ${ds.length} strokes, labelled ${endings.length}`);
  out.push({ kana, romaji, strokes: ds.map((d, i) => ({ d, type: TYPES[endings[i]] })) });
}
writeFileSync(new URL('../src/hiragana.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`wrote ${out.length} kana`);
