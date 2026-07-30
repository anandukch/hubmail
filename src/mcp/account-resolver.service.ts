import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { ConnectedAccount, ConnectedAccountDocument } from '../auth/schemas/connected-account.schema';

export type AccountResolution =
  | { kind: 'resolved'; alias: string }
  | { kind: 'no_accounts' }
  | { kind: 'ambiguous'; aliases: string[] }
  | { kind: 'not_found'; alias: string; aliases: string[] };

@Injectable()
export class AccountResolverService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ConnectedAccount.name)
    private readonly connectedAccountModel: Model<ConnectedAccountDocument>,
  ) {}

  async resolveUserIdByToken(userToken: string): Promise<string | null> {
    const user = await this.userModel.findOne({ mcpUserToken: userToken });
    return user ? user._id.toString() : null;
  }

  async listAliases(userId: string): Promise<string[]> {
    const accounts = await this.connectedAccountModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('alias')
      .sort({ alias: 1 });
    return accounts.map((a) => a.alias);
  }

  /**
   * Implements the spec's account-clarification behavior: no guessing across
   * accounts, no session memory of a previous choice. Used by both
   * search_emails (requestedAlias optional) and read_email (always provided,
   * so this only ever resolves to 'resolved', 'not_found', or 'no_accounts').
   */
  async resolve(userId: string, requestedAlias?: string): Promise<AccountResolution> {
    const aliases = await this.listAliases(userId);

    if (aliases.length === 0) {
      return { kind: 'no_accounts' };
    }

    if (!requestedAlias) {
      if (aliases.length === 1) {
        return { kind: 'resolved', alias: aliases[0] };
      }
      return { kind: 'ambiguous', aliases };
    }

    if (!aliases.includes(requestedAlias)) {
      return { kind: 'not_found', alias: requestedAlias, aliases };
    }

    return { kind: 'resolved', alias: requestedAlias };
  }
}
