import { UserRepository, UserRecord } from '../../infrastructure/repositories/user.repository';
import { NotFoundError }             from '../../domain/errors/AppError';
import { UpdateProfileDto }          from '../dtos/user.dto';
import { AuthUserDto }               from '../dtos/auth.dto';

export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  // ── Get own full profile ──────────────────────────────────────────────────

  async getProfile(userId: string): Promise<AuthUserDto> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User', userId);
    return this.toDto(user);
  }

  // ── Update own profile fields ─────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthUserDto> {
    const updated = await this.userRepo.updateProfile(userId, {
      firstName:  dto.firstName,
      lastName:   dto.lastName,
      jobTitle:   dto.jobTitle,
      department: dto.department,
      avatarUrl:  dto.avatarUrl,
    });
    if (!updated) throw new NotFoundError('User', userId);
    return this.toDto(updated);
  }

  // ── Mapping helper ────────────────────────────────────────────────────────

  private toDto(user: UserRecord): AuthUserDto {
    return {
      id:              user.id,
      email:           user.email,
      firstName:       user.firstName,
      lastName:        user.lastName,
      role:            user.role,
      isEmailVerified: user.isEmailVerified,
      avatarUrl:       user.avatarUrl  ?? undefined,
      jobTitle:        user.jobTitle   ?? undefined,
      department:      user.department ?? undefined,
      createdAt:       user.createdAt.toISOString(),
    };
  }
}
