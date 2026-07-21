import { z } from 'zod';

// ─── Request Schemas ───────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email:      z.string().email('Invalid email address').toLowerCase(),
  password:   z.string()
                .min(8, 'Password must be at least 8 characters')
                .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
                .regex(/[0-9]/, 'Password must contain at least one number')
                .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  firstName:  z.string().min(1).max(100).trim(),
  lastName:   z.string().min(1).max(100).trim(),
  jobTitle:   z.string().max(150).optional(),
  department: z.string().max(150).optional(),
});

export const LoginSchema = z.object({
  email:    z.string().email().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().uuid('Invalid refresh token format'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const ResetPasswordSchema = z.object({
  token:    z.string().min(1, 'Reset token is required'),
  password: z.string()
              .min(8)
              .regex(/[A-Z]/)
              .regex(/[0-9]/)
              .regex(/[^A-Za-z0-9]/),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string()
                    .min(8)
                    .regex(/[A-Z]/)
                    .regex(/[0-9]/)
                    .regex(/[^A-Za-z0-9]/),
});

// ─── Inferred Types ────────────────────────────────────────────────────────────

export type RegisterDto      = z.infer<typeof RegisterSchema>;
export type LoginDto         = z.infer<typeof LoginSchema>;
export type RefreshTokenDto  = z.infer<typeof RefreshTokenSchema>;
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

// ─── Response DTOs ─────────────────────────────────────────────────────────────

export interface AuthUserDto {
  id:               string;
  email:            string;
  firstName:        string;
  lastName:         string;
  role:             string;
  isEmailVerified:  boolean;
  avatarUrl?:       string;
  jobTitle?:        string;
  department?:      string;
  createdAt:        string;
}

export interface LoginResponseDto {
  accessToken:  string;
  tokenType:    'Bearer';
  expiresIn:    number;   // seconds
  user:         AuthUserDto;
}

export interface RefreshResponseDto {
  accessToken: string;
  tokenType:   'Bearer';
  expiresIn:   number;
}

export interface MessageDto {
  message: string;
}
