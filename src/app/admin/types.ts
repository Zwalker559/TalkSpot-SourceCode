
import { z } from 'zod';

export const CreateAuditLogSchema = z.object({
  actorUid: z.string(),
  actorDisplayName: z.string(),
  action: z.enum([
      'user.create',
      'user.edit.display_name',
      'user.edit.display_name_self',
      'user.edit.texting_id',
      'user.edit.role',
      'user.edit.status.suspended',
      'user.edit.status.activated',
      'user.edit.password_reset',
      'user.delete',
      'promotion.create',
      'promotion.edit',
      'promotion.delete',
      'audit.clear',
      'notice.send',
      'notice.clear',
      'system.repair_orphaned_users'
  ]),
  targetInfo: z.object({
    type: z.string(),
    uid: z.string().optional(),
    displayName: z.string().optional(),
  }).optional(),
  details: z.record(z.any()).optional(),
});

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;

export const DisplayNameChangeLogSchema = z.object({
  uid: z.string(),
  oldDisplayName: z.string(),
  newDisplayName: z.string(),
});

export const ClearAuditLogsSchema = z.object({
  actorUid: z.string()
});

export const DeleteUserFullySchema = z.object({
  uidToDelete: z.string(),
});

export const GlobalNoticeSchema = z.object({
  actorUid: z.string(),
  message: z.string().min(1, "Message cannot be empty.").max(500, "Message is too long."),
});

export const RepairOrphanedUsersSchema = z.object({
  actorUid: z.string(),
});
