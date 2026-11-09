import { z } from 'zod';
import { RowId, ShortText } from './common.js';

export const TagScope = z.enum(['buy', 'sold']);
export type TagScope = z.infer<typeof TagScope>;

export const TagColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido (formato hexadecimal #rrggbb)');
export type TagColor = z.infer<typeof TagColor>;

export const CreateTagInput = z.object({ name: ShortText, color: TagColor }).strict();
export type CreateTagInput = z.infer<typeof CreateTagInput>;

export const UpdateTagInput = z
  .object({ name: ShortText.optional(), color: TagColor.optional() })
  .strict();
export type UpdateTagInput = z.infer<typeof UpdateTagInput>;

export const Tag = z.object({
  id: RowId,
  scope: TagScope,
  name: ShortText,
  color: TagColor,
  created_at: z.string(),
});
export type Tag = z.infer<typeof Tag>;

export const TagWithCount = Tag.extend({ buy_count: z.number().int().nonnegative() });
export type TagWithCount = z.infer<typeof TagWithCount>;
