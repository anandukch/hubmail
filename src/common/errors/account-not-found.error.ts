export class AccountNotFoundError extends Error {
  constructor(public readonly alias: string) {
    super(`No account named '${alias}' is connected`);
    this.name = 'AccountNotFoundError';
  }
}
