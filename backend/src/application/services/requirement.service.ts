import { RequirementRepository } from '../../infrastructure/repositories/requirement.repository';
import {
  CreateRequirementDto, UpdateRequirementDto,
  RequirementQuery, LinkRequirementDto,
  RequirementDto, RequirementVersionDto,
} from '../dtos/requirement.dto';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../domain/errors/AppError';

export class RequirementService {
  constructor(private readonly repo: RequirementRepository) {}

  async list(projectId: string, userId: string, query: RequirementQuery): Promise<{
    data: RequirementDto[];
    total: number;
  }> {
    await this.assertProjectAccess(projectId, userId);
    const tags = query.tags
      ? query.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : undefined;
    return this.repo.list({ ...query, projectId, tags });
  }

  async create(projectId: string, userId: string, dto: CreateRequirementDto): Promise<RequirementDto> {
    await this.assertProjectAccess(projectId, userId);
    if (dto.parentId) {
      const parent = await this.repo.findById(dto.parentId);
      if (!parent || parent.projectId !== projectId) {
        throw new BadRequestError('Parent requirement not found in this project');
      }
    }
    const req = await this.repo.create({ ...dto, projectId, createdBy: userId });
    return this.toDto(req);
  }

  async getById(requirementId: string, userId: string): Promise<RequirementDto> {
    const req = await this.repo.findById(requirementId);
    if (!req) throw new NotFoundError('Requirement', requirementId);
    await this.assertProjectAccess(req.projectId, userId);
    return this.toDto(req);
  }

  async update(requirementId: string, userId: string, dto: UpdateRequirementDto): Promise<RequirementDto> {
    const req = await this.repo.findById(requirementId);
    if (!req) throw new NotFoundError('Requirement', requirementId);
    await this.assertProjectAccess(req.projectId, userId);
    const updated = await this.repo.update(requirementId, { ...dto, updatedBy: userId });
    return this.toDto(updated);
  }

  async delete(requirementId: string, userId: string): Promise<void> {
    const req = await this.repo.findById(requirementId);
    if (!req) throw new NotFoundError('Requirement', requirementId);
    await this.assertProjectAccess(req.projectId, userId);
    await this.repo.softDelete(requirementId);
  }

  async getVersionHistory(requirementId: string): Promise<RequirementVersionDto[]> {
    const versions = await this.repo.getVersionHistory(requirementId);
    return versions.map((v) => ({
      id:            v.id,
      requirementId: v.requirementId,
      version:       v.version,
      title:         v.title,
      body:          v.body,
      changedBy:     v.changedBy,
      changeSummary: v.changeSummary ?? null,
      createdAt:     v.createdAt.toISOString(),
    }));
  }

  async createLink(sourceId: string, userId: string, dto: LinkRequirementDto): Promise<void> {
    const source = await this.repo.findById(sourceId);
    if (!source) throw new NotFoundError('Requirement', sourceId);
    const target = await this.repo.findById(dto.targetId);
    if (!target) throw new NotFoundError('Target requirement', dto.targetId);
    if (source.projectId !== target.projectId) {
      throw new BadRequestError('Cannot link requirements across different projects');
    }
    await this.repo.createLink(sourceId, dto.targetId, dto.linkType, userId);
  }

  async createFromFile(
    projectId: string,
    userId: string,
    file: Express.Multer.File,
    title: string,
  ): Promise<RequirementDto> {
    const allowedTypes = ['text/plain', 'text/markdown', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestError('Only .txt, .md, and .pdf files are supported');
    }
    await this.assertProjectAccess(projectId, userId);
    // Text extraction delegated to FileStorageAdapter (pdf-parse / direct read)
    const body = file.buffer.toString('utf-8').trim();
    if (body.length < 10) throw new BadRequestError('Uploaded file appears to be empty');

    const req = await this.repo.create({
      title:   title || file.originalname,
      body,
      projectId,
      createdBy: userId,
      source:  `upload:${file.originalname}`,
    });
    return this.toDto(req);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertProjectAccess(projectId: string, userId: string): Promise<void> {
    const isMember = await this.repo.isProjectMember(projectId, userId);
    if (!isMember) throw new ForbiddenError('You are not a member of this project');
  }

  private toDto(req: any): RequirementDto {
    return {
      id:            req.id,
      projectId:     req.projectId,
      title:         req.title,
      body:          req.body,
      type:          req.type,
      priority:      req.priority,
      status:        req.status,
      source:        req.source        ?? null,
      sourceFileUrl: req.sourceFileUrl ?? null,
      tags:          req.tags          ?? [],
      version:       req.version,
      wordCount:     req.wordCount     ?? 0,
      parentId:      req.parentId      ?? null,
      createdBy:     req.createdBy,
      updatedBy:     req.updatedBy     ?? null,
      analyzedAt:    req.analyzedAt    ? req.analyzedAt.toISOString()  : null,
      approvedAt:    req.approvedAt    ? req.approvedAt.toISOString()  : null,
      createdAt:     req.createdAt.toISOString(),
      updatedAt:     req.updatedAt.toISOString(),
    };
  }
}
