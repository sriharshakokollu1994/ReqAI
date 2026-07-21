import { Request, Response } from 'express';
import { ExportService, ExportFormat } from '../../application/services/export.service';
import { BadRequestError } from '../../domain/errors/AppError';

const VALID_FORMATS: ExportFormat[] = ['pdf', 'docx', 'markdown', 'json'];

export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  // ── GET /export/:analysisId/pdf ────────────────────────────────────────────
  exportPdf = async (req: Request, res: Response): Promise<void> => {
    const { buffer, filename, mimeType } = await this.exportService.exportPdf(
      req.params.analysisId,
      req.user!.sub,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.status(200).end(buffer);
  };

  // ── GET /export/:analysisId/docx ───────────────────────────────────────────
  exportDocx = async (req: Request, res: Response): Promise<void> => {
    const { buffer, filename, mimeType } = await this.exportService.exportDocx(
      req.params.analysisId,
      req.user!.sub,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.status(200).end(buffer);
  };

  // ── GET /export/:analysisId/markdown ──────────────────────────────────────
  exportMarkdown = async (req: Request, res: Response): Promise<void> => {
    const { content, filename, mimeType } = await this.exportService.exportMarkdown(
      req.params.analysisId,
      req.user!.sub,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(content);
  };

  // ── GET /export/:analysisId/json ───────────────────────────────────────────
  exportJson = async (req: Request, res: Response): Promise<void> => {
    const { data, filename } = await this.exportService.exportJson(
      req.params.analysisId,
      req.user!.sub,
    );
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).json(data);
  };

  // ── GET /export/:analysisId/:format  (unified single endpoint) ─────────────
  /**
   * Unified route — dispatches to the correct format handler.
   * Supports: pdf | docx | markdown | json
   */
  exportByFormat = async (req: Request, res: Response): Promise<void> => {
    const fmt = req.params.format as ExportFormat;
    if (!VALID_FORMATS.includes(fmt)) {
      throw new BadRequestError(`Invalid export format "${fmt}". Supported: ${VALID_FORMATS.join(', ')}`);
    }
    switch (fmt) {
      case 'pdf':      return this.exportPdf(req, res);
      case 'docx':     return this.exportDocx(req, res);
      case 'markdown': return this.exportMarkdown(req, res);
      case 'json':     return this.exportJson(req, res);
    }
  };
}
