import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class SessionService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async getSessionVersion(userId: string): Promise<number | null> {
    const user = await this.userModel.findById(userId).select('sessionVersion');
    return user?.sessionVersion ?? null;
  }
}
