import {
  addDays,
  dayKey,
  formatClock,
  formatWeekRange,
  formatWhen,
  isDayKey,
  mealDateTime,
  parseDayKey,
  startOfWeek,
} from '../dates';
import { formatInviteCode, isValidInviteCode, makeInviteCode, normaliseInviteCode } from '../invite-code';
import { nameMatchScore, normaliseName } from '../names';
import { canChangeOwnAdminRole, canLeave, can } from '../permissions';
import { convertQuantity, formatQuantity, fromBase, parseQuantity, toBase } from '../units';
import type { Member } from '../types';
import { at } from './fixtures';

describe('units', () => {
  it('converts to base units and back to the friendliest unit', () => {
    expect(toBase(1.5, 'kg')).toEqual({ amount: 1500, family: 'mass' });
    expect(fromBase(1500, 'mass')).toEqual({ quantity: 1.5, unit: 'kg' });
    expect(fromBase(800, 'mass')).toEqual({ quantity: 800, unit: 'g' });
    expect(fromBase(2000, 'volume')).toEqual({ quantity: 2, unit: 'l' });
    expect(fromBase(3, 'count')).toEqual({ quantity: 3, unit: 'pcs' });
  });

  it('formats quantities for people', () => {
    expect(formatQuantity(500, 'g')).toBe('500 g');
    expect(formatQuantity(1.5, 'l')).toBe('1.5 L');
    expect(formatQuantity(1, 'pack')).toBe('1 pack');
    expect(formatQuantity(2, 'pack')).toBe('2 packs');
    expect(formatQuantity(1, 'pcs')).toBe('1 pc');
    expect(formatQuantity(6, 'pcs')).toBe('6 pcs');
    expect(formatQuantity(0.1 + 0.2, 'kg')).toBe('0.3 kg');
  });

  it('converts only within the same family', () => {
    expect(convertQuantity(500, 'g', 'kg')).toBe(0.5);
    expect(convertQuantity(1.2, 'l', 'ml')).toBe(1200);
    expect(convertQuantity(2, 'pcs', 'g')).toBeNull();
  });

  it('parses typed quantities, including a comma decimal', () => {
    expect(parseQuantity('1.5')).toBe(1.5);
    expect(parseQuantity('1,5')).toBe(1.5);
    expect(parseQuantity(' 3 ')).toBe(3);
    expect(parseQuantity('0')).toBeNull();
    expect(parseQuantity('abc')).toBeNull();
    expect(parseQuantity('-2')).toBeNull();
    expect(parseQuantity('')).toBeNull();
  });
});

describe('dates', () => {
  it('uses the local calendar day, not UTC', () => {
    // 9 am on 26 Nov in Sydney is still 25 Nov in UTC.
    expect(dayKey(new Date(2026, 10, 26, 9, 0))).toBe('2026-11-26');
    expect(dayKey(new Date(2026, 10, 26, 0, 30))).toBe('2026-11-26');
  });

  it('round trips day keys and rejects impossible dates', () => {
    expect(dayKey(parseDayKey('2026-02-28'))).toBe('2026-02-28');
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-11-26')).toBe(true);
    expect(isDayKey('26/11/2026')).toBe(false);
  });

  it('starts weeks on Monday, including when today is Sunday', () => {
    expect(dayKey(startOfWeek(new Date(2026, 10, 26)))).toBe('2026-11-23'); // Thursday
    expect(dayKey(startOfWeek(new Date(2026, 10, 29)))).toBe('2026-11-23'); // Sunday
    expect(dayKey(startOfWeek(new Date(2026, 10, 30)))).toBe('2026-11-30'); // Monday
  });

  it('adds calendar days safely across a daylight saving change', () => {
    // Sydney clocks go forward on Sunday 4 Oct 2026.
    expect(dayKey(addDays(new Date(2026, 9, 3), 1))).toBe('2026-10-04');
    expect(dayKey(addDays(new Date(2026, 9, 3), 2))).toBe('2026-10-05');
  });

  it('builds the meal instant from the day and the group meal times', () => {
    const times = { lunchTime: '12:30', dinnerTime: '18:30' };
    expect(mealDateTime('2026-11-26', 'dinner', times).getTime()).toBe(at(2026, 11, 26, 18, 30));
    expect(mealDateTime('2026-11-26', 'lunch', times).getTime()).toBe(at(2026, 11, 26, 12, 30));
  });

  it('formats times and relative days', () => {
    const now = at(2026, 11, 26, 10);
    expect(formatClock('18:30')).toBe('6:30 pm');
    expect(formatClock('00:15')).toBe('12:15 am');
    expect(formatWhen(at(2026, 11, 26, 18, 30), now)).toBe('Today 6:30 pm');
    expect(formatWhen(at(2026, 11, 27, 9), now)).toBe('Tomorrow 9:00 am');
    expect(formatWhen(at(2026, 11, 29, 9), now)).toBe('Sun 9:00 am');
    expect(formatWhen(at(2026, 12, 10, 9), now)).toBe('10 Dec 9:00 am');
    expect(formatWeekRange(new Date(2026, 10, 23))).toBe('23 to 29 Nov');
    expect(formatWeekRange(new Date(2026, 10, 30))).toBe('30 Nov to 6 Dec');
  });
});

describe('names', () => {
  it('normalises plurals and punctuation the same way on both sides', () => {
    expect(normaliseName('Chicken Thighs')).toBe('chicken thigh');
    expect(normaliseName('Tomatoes')).toBe('tomato');
    expect(normaliseName('Berries!')).toBe('berry');
    expect(normaliseName('Hummus')).toBe('hummus');
    expect(normaliseName('  Glass   noodles ')).toBe('glass noodle');
  });

  it('scores exact and partial word matches', () => {
    expect(nameMatchScore('Chicken thighs', 'chicken thigh')).toBe(2);
    expect(nameMatchScore('Chicken', 'Chicken thighs')).toBe(1);
    expect(nameMatchScore('Beef mince', 'Pork mince')).toBe(0);
    expect(nameMatchScore('Pea', 'Peanut butter')).toBe(0);
  });
});

describe('invite codes', () => {
  it('maps random bytes onto the unambiguous alphabet', () => {
    const code = makeInviteCode(() => new Uint8Array([0, 31, 32, 255, 100, 7]));
    expect(code).toBe('A9A9EH');
    expect(isValidInviteCode(code)).toBe(true);
  });

  it('accepts codes typed with spaces, dashes or lowercase', () => {
    expect(normaliseInviteCode('ktc-h42')).toBe('KTCH42');
    expect(normaliseInviteCode(' ktc h42 ')).toBe('KTCH42');
    expect(isValidInviteCode('KTCH4')).toBe(false);
    expect(isValidInviteCode('KTCH4O')).toBe(false); // O is never issued
    expect(formatInviteCode('KTCH42')).toBe('KTC H42');
  });
});

describe('permissions', () => {
  const member = (uid: string, role: Member['role']): Member => ({
    id: uid,
    uid,
    displayName: uid,
    role,
    joinedAt: 0,
    inviteCode: null,
  });

  it('lets members restock, propose and shop but not take items out', () => {
    expect(can('member', 'addItem')).toBe(true);
    expect(can('member', 'proposeMeal')).toBe(true);
    expect(can('member', 'putAway')).toBe(true);
    expect(can('member', 'takeOutItem')).toBe(false);
    expect(can('member', 'approve')).toBe(false);
    expect(can('admin', 'takeOutItem')).toBe(true);
    expect(can(null, 'addItem')).toBe(false);
  });

  it('never lets the last admin step down or leave while others remain', () => {
    const solo = [member('a', 'admin'), member('b', 'member')];
    expect(canChangeOwnAdminRole(solo, 'a')).toBe(false);
    expect(canLeave(solo, 'a')).toBe(false);
    expect(canLeave(solo, 'b')).toBe(true);
    expect(canLeave([member('a', 'admin')], 'a')).toBe(true);
    const two = [member('a', 'admin'), member('c', 'admin')];
    expect(canChangeOwnAdminRole(two, 'a')).toBe(true);
  });
});
