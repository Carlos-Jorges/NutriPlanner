// Name normalisation, used to match recipe ingredients with fridge items and
// to merge shopping list lines. Deliberately simple and predictable: both
// sides go through the same function, so "Chicken thighs" matches
// "chicken thigh" and "Tomatoes" matches "tomato".

function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('ss') || word.endsWith('us')) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singular)
    .join(' ');
}

/**
 * 2 = same name, 1 = one name contains the other as whole words
 * ("chicken" and "chicken thigh"), 0 = unrelated.
 */
export function nameMatchScore(a: string, b: string): 0 | 1 | 2 {
  const x = normaliseName(a);
  const y = normaliseName(b);
  if (!x || !y) return 0;
  if (x === y) return 2;
  const wx = ` ${x} `;
  const wy = ` ${y} `;
  return wx.includes(wy) || wy.includes(wx) ? 1 : 0;
}

/** Trims and collapses whitespace, keeps the user's capitalisation. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
