import { z } from 'zod';

export const CreateContextSnapshotSchema = z.object({
  battery: z.number().int().min(0).max(100),
  charging: z.boolean(),
  activity: z.string().min(1),
  timeOfDay: z.string().min(1),
  visibility: z.string().min(1),
  network: z.string().min(1),
  location: z.string().optional().nullable(),
  motion: z.string().optional().nullable(),
  heartRate: z.number().int().optional().nullable(),
  
  // Extended fields
  currentTask: z.string().optional().nullable(),
  focusLevel: z.number().int().min(0).max(100).optional().nullable(),
  calendarStatus: z.string().optional().nullable(),
  workingMode: z.string().optional().nullable(),
  deviceStatus: z.string().optional().nullable(),
  manualNotes: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const ContextHistoryQuerySchema = z.object({
  page: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1)).default(1),
  limit: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).max(100)).default(20),
});

export const PatchContextSnapshotSchema = CreateContextSnapshotSchema.partial();

export type CreateContextSnapshotDto = z.infer<typeof CreateContextSnapshotSchema>;
export type PatchContextSnapshotDto = z.infer<typeof PatchContextSnapshotSchema>;
export type ContextHistoryQueryDto = z.infer<typeof ContextHistoryQuerySchema>;

export interface ContextSnapshotResponseDto {
  id: string;
  userId: string;
  battery: number;
  charging: boolean;
  activity: string;
  timeOfDay: string;
  visibility: string;
  network: string;
  location: string | null;
  motion: string | null;
  heartRate: number | null;
  
  currentTask: string | null;
  focusLevel: number | null;
  calendarStatus: string | null;
  workingMode: string | null;
  deviceStatus: string | null;
  manualNotes: string | null;
  metadata: Record<string, any> | null;
  
  createdAt: string;
}
