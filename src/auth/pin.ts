// PIN checking with the browser's own Web Crypto: PBKDF2-SHA256 over a per-person random salt,
// the same parameters as scripts/make_accounts.py. The PIN is never stored or logged.

import type { Account, AccountsFile } from '../data/types.ts'

export type Kdf = AccountsFile['meta']['kdf']

export const PIN_LENGTH = 4

export function isPinShaped(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, kdf: Kdf): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: kdf.hash, salt, iterations: kdf.iterations }, key, kdf.keyBytes * 8)
  return new Uint8Array(bits)
}

/** Compares every byte whatever the first difference, so the time taken says nothing about the PIN. */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function verifyPin(account: Account, pin: string, kdf: Kdf): Promise<boolean> {
  if (!isPinShaped(pin)) return false
  const got = await derive(pin, fromB64(account.salt), kdf)
  return sameBytes(got, fromB64(account.hash))
}
