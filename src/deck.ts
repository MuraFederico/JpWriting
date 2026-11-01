// The order kana come up in: the selected pool, shuffled once (or kept in gojūon order) and dealt one by one.
// A new deck is dealt only when this one runs out, so nothing repeats before the whole set has come up.

export function deal(pool: number[], shuffle: boolean, avoidFirst?: number): number[] {
  const d = [...pool];
  if (!shuffle) return d;
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  if (d.length > 1 && d[0] === avoidFirst) [d[0], d[1]] = [d[1], d[0]]; // no repeat across decks
  return d;
}

export function draw(deck: number[], current: number, pool: number[], shuffle: boolean): { deck: number[]; next: number } {
  const i = deck.indexOf(current);
  if (i >= 0 && i + 1 < deck.length) return { deck, next: deck[i + 1] };
  const fresh = deal(pool, shuffle, current);
  return { deck: fresh, next: fresh[0] };
}
