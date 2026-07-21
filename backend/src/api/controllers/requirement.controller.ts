import { Request, Response } from 'express';
import { RequirementService } from '../../application/services/requirement.service';
import { sendSuccess, sendCreated, sendNoContent, buildPaginationMeta } from '../../shared/response';
import {
  CreateRequirementDto, UpdateRequirementDto,
  RequirementQuery, LinkRequirementDto,
} from '../../application/dtos/requirement.dto';

export class RequirementController {
  constructor(private readonly requirementService: RequirementService) {}

  /**
   * @openapi
   * /projects/{projectId}/requirements:
   *   get:
   *     tags: [Requirements]
   *     summary: List requirements for a project
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/ProjectId'
   *       - $ref: '#/components/parameters/Page'
   *       - $ref: '#/components/parameters/Limit'
   *       - name: status
   *         in: query
   *         schema:
   *           $ref: '#/components/schemas/RequirementStatus'
   *       - name: search
   *         in: query
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Paginated list of requirements
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RequirementListResponse'
   */
  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as RequirementQuery;
    const { data, total } = await this.requirementService.list(
      req.params.projectId,
      req.user!.sub,
      query,
    );
    sendSuccess(res, data, 200, buildPaginationMeta(query.page, query.limit, total));
  };

  /**
   * @openapi
   * /projects/{projectId}/requirements:
   *   post:
   *     tags: [Requirements]
   *     summary: Create a new requirement
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateRequirementRequest'
   *     responses:
   *       201:
   *         description: Requirement created
   */
  create = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as CreateRequirementDto;
    const requirement = await this.requirementService.create(
      req.params.projectId,
      req.user!.sub,
      dto,
    );
    sendCreated(res, requirement);
  };

  /**
   * @openapi
   * /projects/{projectId}/requirements/{requirementId}:
   *   get:
   *     tags: [Requirements]
   *     summary: Get requirement by ID
   *     security:
   *       - bearerAuth: []
   */
  getById = async (req: Request, res: Response): Promise<void> => {
    const requirement = await this.requirementService.getById(
      req.params.requirementId,
      req.user!.sub,
    );
    sendSuccess(res, requirement);
  };

  /**
   * @openapi
   * /projects/{projectId}/requirements/{requirementId}:
   *   put:
   *     tags: [Requirements]
   *     summary: Update a requirement (triggers version increment if body changes)
   *     security:
   *       - bearerAuth: []
   */
  update = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as UpdateRequirementDto;
    const requirement = await this.requirementService.update(
      req.params.requirementId,
      req.user!.sub,
      dto,
    );
    sendSuccess(res, requirement);
  };

  /**
   * @openapi
   * /projects/{projectId}/requirements/{requirementId}:
   *   delete:
   *     tags: [Requirements]
   *     summary: Soft-delete a requirement
   *     security:
   *       - bearerAuth: []
   */
  delete = async (req: Request, res: Response): Promise<void> => {
    await this.requirementService.delete(req.params.requirementId, req.user!.sub);
    sendNoContent(res);
  };

  /**
   * @openapi
   * /projects/{projectId}/requirements/{requirementId}/versions:
   *   get:
   *     tags: [Requirements]
   *     summary: Get full version history of a requirement
   *     security:
   *       - bearerAuth: []
   */
  getVersionHistory = async (req: Request, res: Response): Promise<void> => {
    const versions = await this.requirementService.getVersionHistory(req.params.requirementId);
    sendSuccess(res, versions);
  };

  /**
   * @openapi
   * /projects/{projectId}/requirements/{requirementId}/links:
   *   post:
   *     tags: [Requirements]
   *     summary: Link two requirements (related, depends-on, conflicts-with, etc.)
   *     security:
   *       - bearerAuth: []
   */
  createLink = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as LinkRequirementDto;
    await this.requirementService.createLink(req.params.requirementId, req.user!.sub, dto);
    sendSuccess(res, { message: 'Link created successfully' });
  };

  /**
   * @openapi
   * /projects/{projectId}/requirements/upload:
   *   post:
   *     tags: [Requirements]
   *     summary: Upload a requirement document (.txt, .md, .pdf)
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *               title:
   *                 type: string
   */
  upload = async (req: Request, res: Response): Promise<void> => {
    const requirement = await this.requirementService.createFromFile(
      req.params.projectId,
      req.user!.sub,
      req.file!,
      req.body.title ?? '',
    );
    sendCreated(res, requirement);
  };
}
