export class AccountReauthRequiredError extends Error {
  constructor(public readonly alias: string) {
    super(`Account '${alias}' needs to be reconnected`);
    this.name = 'AccountReauthRequiredError';
  }
}
