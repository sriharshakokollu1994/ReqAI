import { Request, Response } from 'express';
import { AdminService }      from '../../application/services/admin.service';
import { sendSuccess, sendNoContent } from '../../shared/response';
import {
  AdminListUsersQuery, ChangeRoleDto, ChangeStatusDto,
} from '../../application/dtos/admin.dto';

export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /admin/users
   * Paginated user list with optional role, status, and search filters.
   */
  listUsers = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AdminListUsersQuery;
    const result = await this.adminService.listUsers(query);
    sendSuccess(res, result.users, 200, result.meta);
  };

  /**
   * GET /admin/users/:id
   * Full profile of a single user.
   */
  getUser = async (req: Request, res: Response): Promise<void> => {
    const id   = req.params['id'] as string;
    const user = await this.adminService.getUserById(id);
    sendSuccess(res, user);
  };

  /**
   * PATCH /admin/users/:id/role
   * Change a user's role. Admins cannot change their own role.
   */
  changeRole = async (req: Request, res: Response): Promise<void> => {
    const id   = req.params['id'] as string;
    const dto  = req.body as ChangeRoleDto;
    const user = await this.adminService.changeRole(id, req.user!.sub, dto);
    sendSuccess(res, user);
  };

  /**
   * PATCH /admin/users/:id/status
   * Activate or deactivate a user. Admins cannot deactivate themselves.
   */
  changeStatus = async (req: Request, res: Response): Promise<void> => {
    const id   = req.params['id'] as string;
    const dto  = req.body as ChangeStatusDto;
    const user = await this.adminService.changeStatus(id, req.user!.sub, dto);
    sendSuccess(res, user);
  };

  /**
   * DELETE /admin/users/:id
   * Soft-delete a user. Admins cannot delete themselves.
   */
  deleteUser = async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    await this.adminService.deleteUser(id, req.user!.sub);
    sendNoContent(res);
  };
}
