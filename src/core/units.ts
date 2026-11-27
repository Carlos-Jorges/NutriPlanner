// Strict unit list, as agreed: no free text units, so quantities can be
// added up reliably for the shopping list.

import type { Unit } from './types';

export const UNITS: readonly Unit[] = ['g', 'kg', 'ml', 'l', 'pcs', 'pack'];

export const UNIT_LABEL: Record<Unit, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'L',
  pcs: 'pcs',
  pack: 'pack',
};

export type UnitFamily = 'mass' | 'volume' | 'count' | 'pack';

const FAMILY: Record<Unit, UnitFamily> = {
  g: 'mass',
  kg: 'mass',
  ml: 'volume',
  l: 'volume',
  pcs: 'count',
  pack: 'pack',
};

const TO_BASE: Record<Unit, number> = { g: 1, kg: 1000, ml: 1, l: 1000, pcs: 1, pack: 1 };

export function isUnit(value: unknown): value is Unit {
  return typeof value === 'string' && (UNITS as readonly string[]).includes(value);
}

export function unitFamily(unit: Unit): UnitFamily {
  return FAMILY[unit];
}

/** Removes floating point noise: 0.1 + 0.2 becomes 0.3. */
export function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Converts to the base unit of the family (g, ml, pcs or pack). */
export function toBase(quantity: number, unit: Unit): { amount: number; family: UnitFamily } {
  return { amount: roundQty(quantity * TO_BASE[unit]), family: FAMILY[unit] };
}

/** Converts a base amount back to the friendliest unit: 1500 g becomes 1.5 kg. */
export function fromBase(amount: number, family: UnitFamily): { quantity: number; unit: Unit } {
  switch (family) {
    case 'mass':
      return amount >= 1000 ? { quantity: roundQty(amount / 1000), unit: 'kg' } : { quantity: roundQty(amount), unit: 'g' };
    case 'volume':
      return amount >= 1000 ? { quantity: roundQty(amount / 1000), unit: 'l' } : { quantity: roundQty(amount), unit: 'ml' };
    case 'count':
      return { quantity: roundQty(amount), unit: 'pcs' };
    case 'pack':
      return { quantity: roundQty(amount), unit: 'pack' };
  }
}

/** Converts between units of the same family (500 g to 0.5 kg). Null if the families differ. */
export function convertQuantity(quantity: number, from: Unit, to: Unit): number | null {
  if (FAMILY[from] !== FAMILY[to]) return null;
  return roundQty((quantity * TO_BASE[from]) / TO_BASE[to]);
}

export function formatNumber(value: number): string {
  return String(roundQty(value));
}

/** "500 g", "1.5 L", "6 pcs", "2 packs" */
export function formatQuantity(quantity: number, unit: Unit): string {
  const n = formatNumber(quantity);
  if (unit === 'pack') return `${n} ${quantity === 1 ? 'pack' : 'packs'}`;
  if (unit === 'pcs' && quantity === 1) return '1 pc';
  return `${n} ${UNIT_LABEL[unit]}`;
}

/** Parses user input such as "1.5" or "1,5". Returns null when it is not a positive number. */
export function parseQuantity(input: string): number | null {
  const cleaned = input.trim().replace(',', '.');
  if (!/^\d*\.?\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? roundQty(value) : null;
}
