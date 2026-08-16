import { Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class RenameAccountDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9-_]{1,40}$/, { message: 'Alias must be 1-40 characters: letters, numbers, - or _' })
  newAlias!: string;
}
