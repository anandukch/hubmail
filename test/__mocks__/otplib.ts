// otplib v13's dependency tree (@noble/hashes, @scure/base, etc.) is pure ESM with no
// CJS build, which Jest's module system can't load even though real Node 22+/26 handles
// it fine via native require(esm) interop. The e2e suite doesn't exercise MFA behavior
// (that's covered by unit tests that mock this module per-test), so stub it out globally
// here purely to keep module resolution working when auth.module.ts loads MfaService.

export function generateSecret(): string {
  return 'MOCKSECRETMOCKSECRET';
}

export function generateURI(): string {
  return 'otpauth://totp/mock?secret=MOCKSECRETMOCKSECRET';
}

export async function verify(): Promise<{ valid: boolean }> {
  return { valid: false };
}
