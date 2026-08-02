import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../auth/schemas/audit-log.schema';

export interface LogEntry {
  userId: string;
  tool: string;
  alias?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  log(entry: LogEntry): void {
    this.auditLogModel
      .create({ ...entry, userId: new Types.ObjectId(entry.userId) })
      .catch(() => undefined);
  }

  async getForUser(userId: string, limit = 100): Promise<AuditLogDocument[]> {
    return this.auditLogModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec() as unknown as AuditLogDocument[];
  }
}
