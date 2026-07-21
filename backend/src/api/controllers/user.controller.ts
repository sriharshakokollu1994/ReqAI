import { Request, Response } from 'express';
import { UserService }       from '../../application/services/user.service';
import { sendSuccess }       from '../../shared/response';
import { UpdateProfileDto }  from '../../application/dtos/user.dto';

export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /users/me
   * Returns the full profile of the currently authenticated user.
   */
  getMe = async (req: Request, res: Response): Promise<void> => {
    const user = await this.userService.getProfile(req.user!.sub);
    sendSuccess(res, user);
  };

  /**
   * PATCH /users/me
   * Partially updates the authenticated user's profile.
   * Users may only edit: firstName, lastName, jobTitle, department, avatarUrl.
   */
  updateMe = async (req: Request, res: Response): Promise<void> => {
    const dto  = req.body as UpdateProfileDto;
    const user = await this.userService.updateProfile(req.user!.sub, dto);
    sendSuccess(res, user);
  };
}
