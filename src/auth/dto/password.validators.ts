import { registerDecorator, ValidationOptions } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 12;
// bcrypt silently truncates input beyond 72 bytes — reject overlong passwords outright
// rather than pre-hashing, since multi-byte UTF-8 chars mean char-count and byte-count diverge.
const PASSWORD_MAX_BYTES = 72;

export function IsPasswordByteLengthValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPasswordByteLengthValid',
      target: object.constructor,
      propertyName,
      options: {
        message: `Password must be at most ${PASSWORD_MAX_BYTES} bytes`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES;
        },
      },
    });
  };
}
