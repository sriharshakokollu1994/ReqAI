import { UserRepository, UserRecord }  from '../../infrastructure/repositories/user.repository';
import { NotFoundError, BadRequestError } from '../../domain/errors/AppError';
import { buildPaginationMeta, PaginationMeta } from '../../shared/response';
import {
  AdminListUsersQuery, ChangeRoleDto, ChangeStatusDto, AdminUserDto,
} from '../dtos/admin.dto';
import { UserRole } from '../../domain/types/UserRole';

export class AdminService {
  constructor(private readonly userRepo: UserRepository) {}

  // ── List users with pagination + filters ──────────────────────────────────

  async listUsers(query: AdminListUsersQuery): Promise<{
    users: AdminUserDto[];
    meta:  PaginationMeta;
  }> {
    const { users, total } = await this.userRepo.findAll({
      page:     query.page,
      limit:    query.limit,
      role:     query.role,
      isActive: query.isActive,
      search:   query.search,
    });
    return {
      users: users.map((u) => this.toDto(u)),
      meta:  buildPaginationMeta(query.page, query.limit, total),
    };
  }

  // ── Get a single user by id ───────────────────────────────────────────────

  async getUserById(userId: string): Promise<AdminUserDto> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User', userId);
    return this.toDto(user);
  }

  // ── Change user role ──────────────────────────────────────────────────────

  async changeRole(
    targetUserId:    string,
    requestingUserId: string,
    dto: ChangeRoleDto,
  ): Promise<AdminUserDto> {
    if (targetUserId === requestingUserId) {
      throw new BadRequestError('Administrators cannot change their own role');
    }
    const updated = await this.userRepo.updateRole(targetUserId, dto.role);
    if (!updated) throw new NotFoundError('User', targetUserId);
    return this.toDto(updated);
  }

  // ── Activate / deactivate user ────────────────────────────────────────────

  async changeStatus(
    targetUserId:    string,
    requestingUserId: string,
    dto: ChangeStatusDto,
  ): Promise<AdminUserDto> {
    if (targetUserId === requestingUserId) {
      throw new BadRequestError('Administrators cannot deactivate themselves');
    }
    const updated = await this.userRepo.updateStatus(targetUserId, dto.isActive);
    if (!updated) throw new NotFoundError('User', targetUserId);
    return this.toDto(updated);
  }

  // ── Soft delete ───────────────────────────────────────────────────────────

  async deleteUser(targetUserId: string, requestingUserId: string): Promise<void> {
    if (targetUserId === requestingUserId) {
      throw new BadRequestError('Administrators cannot delete themselves');
    }
    const user = await this.userRepo.findById(targetUserId);
    if (!user) throw new NotFoundError('User', targetUserId);
    await this.userRepo.softDelete(targetUserId);
  }

  // ── Mapping helper ────────────────────────────────────────────────────────

  private toDto(user: UserRecord): AdminUserDto {
    return {
      id:               user.id,
      email:            user.email,
      firstName:        user.firstName,
      lastName:         user.lastName,
      role:             user.role as UserRole,
      isActive:         user.isActive,
      isEmailVerified:  user.isEmailVerified,
      avatarUrl:        user.avatarUrl   ?? null,
      jobTitle:         user.jobTitle    ?? null,
      department:       user.department  ?? null,
      failedLoginCount: user.failedLoginCount,
      lockedUntil:      user.lockedUntil  ? user.lockedUntil.toISOString()  : null,
      lastLoginAt:      user.lastLoginAt  ? user.lastLoginAt.toISOString()  : null,
      createdAt:        user.createdAt.toISOString(),
    };
  }
}
