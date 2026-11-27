// Authentication interface, with input checks shared by both implementations.

import { AppError } from '@/core/errors';
import type { Unsubscribe } from './store';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string | null;
}

export interface AuthGateway {
  readonly kind: 'firebase' | 'demo';
  onChange(listener: (user: AuthUser | null) => void): Unsubscribe;
  signIn(email: string, password: string): Promise<AuthUser>;
  signUp(displayName: string, email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
}

export const MIN_PASSWORD_LENGTH = 8;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new AppError('invalid-email');
}

export function assertNewPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) throw new AppError('weak-password');
}
