import * as bcrypt from 'bcryptjs';

// First-party password hashing (locked decision: no third-party auth). bcryptjs
// is pure-JS so it builds anywhere; upgrade to argon2id in hardening (Module 7).
const ROUNDS = 10;

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, ROUNDS);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);
