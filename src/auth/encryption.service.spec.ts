import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { EncryptionService } from './encryption.service';
import { AppConfig } from '../config/configuration';

function buildService(): EncryptionService {
  const key = randomBytes(32).toString('hex');
  const config = { get: () => key } as unknown as ConfigService<AppConfig, true>;
  return new EncryptionService(config);
}

describe('EncryptionService', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const service = buildService();
    const plaintext = 'a-very-secret-refresh-token';

    const ciphertext = service.encrypt(plaintext);
    expect(ciphertext).not.toEqual(plaintext);

    const decrypted = service.decrypt(ciphertext);
    expect(decrypted).toEqual(plaintext);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const service = buildService();
    const a = service.encrypt('same-input');
    const b = service.encrypt('same-input');
    expect(a).not.toEqual(b);
  });

  it('throws when ciphertext has been tampered with', () => {
    const service = buildService();
    const ciphertext = service.encrypt('sensitive-value');
    const tampered = Buffer.from(ciphertext, 'base64');
    tampered[tampered.length - 1] ^= 0xff;

    expect(() => service.decrypt(tampered.toString('base64'))).toThrow();
  });
});
