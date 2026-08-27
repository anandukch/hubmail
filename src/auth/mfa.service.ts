import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';
import * as qrcode from 'qrcode';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const ISSUER = 'hubmail';
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BCRYPT_ROUNDS = 10;
// allow +/-1 time step (30s) of clock drift between server and authenticator app
const EPOCH_TOLERANCE = 1;

@Injectable()
export class MfaService {
  generateSecret(): string {
    return generateSecret();
  }

  async buildQrDataUrl(email: string, secret: string): Promise<string> {
    const uri = generateURI({ issuer: ISSUER, label: email, secret });
    return qrcode.toDataURL(uri);
  }

  async verifyToken(secret: string, token: string): Promise<boolean> {
    // otplib throws (rather than returning invalid) for malformed input, e.g. a recovery
    // code shape landing here — treat any such failure as "not a valid TOTP code".
    try {
      const result = await verify({ secret, token, epochTolerance: EPOCH_TOLERANCE });
      return result.valid;
    } catch {
      return false;
    }
  }

  generateRecoveryCodes(): string[] {
    return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const raw = randomBytes(5).toString('hex'); // 10 hex chars
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
  }

  hashRecoveryCodes(codes: string[]): Promise<string[]> {
    return Promise.all(codes.map((code) => bcrypt.hash(code, RECOVERY_CODE_BCRYPT_ROUNDS)));
  }

  /**
   * Returns the index of the matching hash if `submitted` matches one of `hashes`, else -1.
   * Caller is responsible for removing the consumed hash so each code works only once.
   */
  async findMatchingRecoveryCodeIndex(hashes: string[], submitted: string): Promise<number> {
    for (let i = 0; i < hashes.length; i++) {
      if (await bcrypt.compare(submitted, hashes[i])) {
        return i;
      }
    }
    return -1;
  }
}
