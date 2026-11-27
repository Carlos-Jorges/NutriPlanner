// Invite codes: 6 characters from a 32 character alphabet with no
// look-alikes (no 0, O, 1 or I), so they are easy to read out loud.
// 32 divides 256 exactly, so mapping random bytes is unbiased.

export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_LENGTH = 6;
export const INVITE_TTL_DAYS = 7;

export function makeInviteCode(randomBytes: (count: number) => Uint8Array): string {
  const bytes = randomBytes(INVITE_LENGTH);
  let code = '';
  for (let i = 0; i < INVITE_LENGTH; i++) {
    code += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return code;
}

/** Uppercases and strips spaces or dashes the user may have typed. */
export function normaliseInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidInviteCode(code: string): boolean {
  return code.length === INVITE_LENGTH && [...code].every((c) => INVITE_ALPHABET.includes(c));
}

/** "KTC H42" style grouping for display. */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}
