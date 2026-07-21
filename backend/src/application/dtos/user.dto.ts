import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  firstName:  z.string().min(1, 'First name cannot be empty').max(100).trim().optional(),
  lastName:   z.string().min(1, 'Last name cannot be empty').max(100).trim().optional(),
  jobTitle:   z.string().max(150).trim().optional(),
  department: z.string().max(150).trim().optional(),
  avatarUrl:  z.string().url('Invalid avatar URL').optional().or(z.literal('')),
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
