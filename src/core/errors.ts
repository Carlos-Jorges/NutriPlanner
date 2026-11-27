// One error type crosses every layer boundary. Firebase error codes are
// translated here and nowhere else, so screens only ever show these messages.

export type ErrorCode =
  | 'invalid-email'
  | 'weak-password'
  | 'email-in-use'
  | 'wrong-credentials'
  | 'too-many-requests'
  | 'network'
  | 'permission-denied'
  | 'not-found'
  | 'invite-invalid'
  | 'invite-expired'
  | 'last-admin'
  | 'fridge-not-empty'
  | 'validation'
  | 'unknown';

const MESSAGES: Record<ErrorCode, string> = {
  'invalid-email': 'Enter a valid email address.',
  'weak-password': 'Use at least 8 characters for your password.',
  'email-in-use': 'An account with this email already exists. Sign in instead.',
  'wrong-credentials': 'That email and password do not match an account.',
  'too-many-requests': 'Too many attempts. Wait a minute and try again.',
  network: 'No connection. Check your internet and try again.',
  'permission-denied': 'You do not have permission to do that in this group.',
  'not-found': 'That item no longer exists. It may have been removed by someone else.',
  'invite-invalid': 'That invite code does not exist. Check it with your group admin.',
  'invite-expired': 'That invite code has expired. Ask an admin for a new one.',
  'last-admin': 'Make someone else an admin first, so the group is never left without one.',
  'fridge-not-empty': 'Move or remove the items in this fridge before deleting it.',
  validation: 'Some details are missing or invalid.',
  unknown: 'Something went wrong. Try again.',
};

export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? MESSAGES[code]);
    this.code = code;
    this.name = 'AppError';
  }
}

const FIREBASE_CODES: Record<string, ErrorCode> = {
  'auth/invalid-email': 'invalid-email',
  'auth/missing-email': 'invalid-email',
  'auth/weak-password': 'weak-password',
  'auth/missing-password': 'wrong-credentials',
  'auth/email-already-in-use': 'email-in-use',
  'auth/invalid-credential': 'wrong-credentials',
  'auth/invalid-login-credentials': 'wrong-credentials',
  'auth/wrong-password': 'wrong-credentials',
  'auth/user-not-found': 'wrong-credentials',
  'auth/too-many-requests': 'too-many-requests',
  'auth/network-request-failed': 'network',
  'permission-denied': 'permission-denied',
  'firestore/permission-denied': 'permission-denied',
  unavailable: 'network',
  'firestore/unavailable': 'network',
  'not-found': 'not-found',
  'firestore/not-found': 'not-found',
};

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && FIREBASE_CODES[code]) return new AppError(FIREBASE_CODES[code]);
  return new AppError('unknown');
}

export function errorMessage(error: unknown): string {
  return toAppError(error).message;
}
