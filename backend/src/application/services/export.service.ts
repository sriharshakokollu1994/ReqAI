/**
 * ExportService
 *
 * Generates analysis exports in four formats:
 *   • PDF      — pdfkit, branded A4, cover + TOC + 14 artifact sections
 *   • DOCX     — docx (officegen-style), headings + tables + lists
 *   • Markdown — GitHub-Flavoured Markdown, full fidelity
 *   • JSON     — raw structured data with metadata envelope
 *
 * All formats support all 14 v2 artifact types:
 *   SUMMARY | FUNCTIONAL_REQUIREMENTS | NON_FUNCTIONAL_REQUIREMENTS |
 *   BUSINESS_RULES | ACTORS | APIS | DATABASE_TABLES | VALIDATION_RULES |
 *   ACCEPTANCE_CRITERIA | DEPENDENCIES | RISKS | OPEN_QUESTIONS |
 *   DEVELOPMENT_TASKS | STORY_POINTS
 */

import PDFDocument from 'pdfkit';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, TableOfContents,
  ExternalHyperlink, PageBreak, HorizontalPositionAlign,
  VerticalAlign,
} from 'docx';
import { AnalysisRepository } from '../../infrastructure/repositories/analysis.repository';
import { NotFoundError } from '../../domain/errors/AppError';
import { logger } from '../../shared/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ExportFormat = 'pdf' | 'docx' | 'markdown' | 'json';

interface ArtifactDoc {
  artifactType:    string;
  content:         Record<string, any>;
  confidenceScore: number | null;
}

interface AnalysisDoc {
  id:            string;
  requirementId: string;
  aiProvider:    string;
  aiModel:       string;
  promptVersion: string | null;
  completedAt:   Date | null;
  tokensTotal:   number | null;
  costUsd:       number | null;
  durationMs:    number | null;
  artifacts:     ArtifactDoc[];
  requirement?: {
    title: string;
    body:  string;
    type:  string;
    priority: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand tokens (PDF + DOCX)
// ─────────────────────────────────────────────────────────────────────────────

const B = {
  primary:  '#6C63FF',
  accent:   '#00D4AA',
  dark:     '#1A1A2E',
  muted:    '#57606A',
  border:   '#E5E7EB',
  bg:       '#F7F8FA',
  white:    '#FFFFFF',
  danger:   '#EF4444',
  warning:  '#F59E0B',
  success:  '#10B981',
  text:     '#1F2328',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Artifact display titles
// ─────────────────────────────────────────────────────────────────────────────

const ARTIFACT_TITLES: Record<string, string> = {
  SUMMARY:                    'Summary',
  FUNCTIONAL_REQUIREMENTS:    'Functional Requirements',
  NON_FUNCTIONAL_REQUIREMENTS:'Non-Functional Requirements',
  BUSINESS_RULES:             'Business Rules',
  ACTORS:                     'Actors & Personas',
  APIS:                       'API Endpoints',
  DATABASE_TABLES:            'Database Tables',
  VALIDATION_RULES:           'Validation Rules',
  ACCEPTANCE_CRITERIA:        'Acceptance Criteria',
  DEPENDENCIES:               'Dependencies',
  RISKS:                      'Risk Register',
  OPEN_QUESTIONS:             'Open Questions',
  DEVELOPMENT_TASKS:          'Development Tasks',
  STORY_POINTS:               'Story Points & Sprint Plan',
};

// ─────────────────────────────────────────────────────────────────────────────
// ExportService
// ─────────────────────────────────────────────────────────────────────────────

export class ExportService {
  constructor(private readonly repo: AnalysisRepository) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // Public entry points
  // ═══════════════════════════════════════════════════════════════════════════

  async exportPdf(analysisId: string, _userId: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const analysis = await this.load(analysisId);
    const buffer   = await this.buildPdf(analysis);
    const filename = `reqai-analysis-${analysisId.slice(0, 8)}.pdf`;
    logger.info('ExportService: PDF exported', { analysisId, bytes: buffer.length });
    return { buffer, filename, mimeType: 'application/pdf' };
  }

  async exportDocx(analysisId: string, _userId: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const analysis = await this.load(analysisId);
    const buffer   = await this.buildDocx(analysis);
    const filename = `reqai-analysis-${analysisId.slice(0, 8)}.docx`;
    logger.info('ExportService: DOCX exported', { analysisId, bytes: buffer.length });
    return {
      buffer,
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  async exportMarkdown(analysisId: string, _userId: string): Promise<{ content: string; filename: string; mimeType: string }> {
    const analysis = await this.load(analysisId);
    const content  = this.buildMarkdown(analysis);
    const filename = `reqai-analysis-${analysisId.slice(0, 8)}.md`;
    return { content, filename, mimeType: 'text/markdown; charset=utf-8' };
  }

  async exportJson(analysisId: string, _userId: string): Promise<{ data: object; filename: string; mimeType: string }> {
    const analysis = await this.load(analysisId);
    const filename = `reqai-analysis-${analysisId.slice(0, 8)}.json`;
    return {
      mimeType: 'application/json',
      filename,
      data: {
        exportedAt:    new Date().toISOString(),
        schemaVersion: '2.0',
        analysisId:    analysis.id,
        requirementId: analysis.requirementId,
        requirement:   analysis.requirement ?? null,
        aiProvider:    analysis.aiProvider,
        aiModel:       analysis.aiModel,
        promptVersion: analysis.promptVersion,
        tokensTotal:   analysis.tokensTotal,
        costUsd:       analysis.costUsd,
        durationMs:    analysis.durationMs,
        completedAt:   analysis.completedAt,
        artifacts:     analysis.artifacts,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private: load & guard
  // ═══════════════════════════════════════════════════════════════════════════

  private async load(analysisId: string): Promise<AnalysisDoc> {
    const analysis = await this.repo.findByIdWithArtifacts(analysisId);
    if (!analysis) throw new NotFoundError('Analysis', analysisId);
    return analysis as AnalysisDoc;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PDF BUILDER (pdfkit)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildPdf(analysis: AnalysisDoc): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ autoFirstPage: true, margin: 52, size: 'A4', bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data',  (c: Buffer) => chunks.push(c));
      doc.on('end',   ()          => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;
      const H = doc.page.height;
      const M = 52;          // margin
      const CW = W - M * 2;  // content width

      // ── helpers ──────────────────────────────────────────────────────────

      const sectionHeader = (title: string) => {
        const y0 = doc.y;
        doc.rect(M, y0, CW, 32).fill(B.dark);
        doc.fillColor(B.accent).font('Helvetica-Bold').fontSize(13)
          .text(title, M + 12, y0 + 9, { width: CW - 24, lineBreak: false });
        doc.moveDown(0.8);
        doc.fillColor(B.text).font('Helvetica').fontSize(10);
      };

      const subheading = (text: string) => {
        doc.fillColor(B.primary).font('Helvetica-Bold').fontSize(11).text(text);
        doc.moveDown(0.25);
        doc.fillColor(B.text).font('Helvetica').fontSize(10);
      };

      const body = (text: string) => {
        if (!text) return;
        doc.fillColor(B.text).font('Helvetica').fontSize(10).text(text, { lineGap: 3 });
        doc.moveDown(0.4);
      };

      const kv = (key: string, val: string) => {
        if (!val) return;
        doc.fillColor(B.muted).font('Helvetica-Bold').fontSize(9)
          .text(key.toUpperCase() + ': ', { continued: true })
          .fillColor(B.text).font('Helvetica').fontSize(9).text(val);
        doc.moveDown(0.15);
      };

      const bullet = (text: string) => {
        doc.fillColor(B.text).font('Helvetica').fontSize(10)
          .text(`\u2022  ${text}`, M + 12, doc.y, { width: CW - 12, lineGap: 2 });
        doc.moveDown(0.1);
      };

      const confidence = (score: number | null | undefined) => {
        if (score == null) return;
        const pct = Math.round(score * 100);
        const col = pct >= 80 ? B.success : pct >= 60 ? B.warning : B.danger;
        doc.fillColor(col).font('Helvetica-Bold').fontSize(8)
          .text(`Confidence: ${pct}%`, { align: 'right' });
        doc.moveDown(0.2);
        doc.fillColor(B.text).font('Helvetica').fontSize(10);
      };

      const badge = (text: string, bg: string) => {
        const saved = doc.y;
        doc.rect(M, saved, doc.widthOfString(text) + 12, 14).fill(bg + '22');
        doc.fillColor(bg).font('Helvetica-Bold').fontSize(8)
          .text(text, M + 6, saved + 2);
        doc.moveDown(0.5);
        doc.fillColor(B.text).font('Helvetica').fontSize(10);
      };

      const hr = () => {
        doc.moveTo(M, doc.y).lineTo(W - M, doc.y).stroke(B.border);
        doc.moveDown(0.5);
      };

      const needPage = (needed = 80) => {
        if (doc.y > H - needed) { doc.addPage(); }
      };

      // ── COVER PAGE ────────────────────────────────────────────────────────

      // top gradient bar
      doc.rect(0, 0, W, 6).fill(B.primary);
      doc.rect(0, 6, W, 2).fill(B.accent);

      // hero block
      doc.rect(0, 60, W, 140).fill(B.dark);
      doc.fillColor(B.white).font('Helvetica-Bold').fontSize(36)
        .text('ReqAI', M, 88, { lineBreak: false });
      doc.fillColor(B.accent).font('Helvetica').fontSize(11)
        .text('AI REQUIREMENT ANALYZER', M, 132, { letterSpacing: 2 });
      doc.fillColor(B.white).font('Helvetica-Bold').fontSize(20)
        .text('Analysis Report', W - M - 180, 100);

      // meta table
      const mY = 240;
      const meta: [string, string][] = [
        ['Analysis ID',   analysis.id],
        ['AI Provider',   `${analysis.aiProvider} / ${analysis.aiModel}`],
        ['Prompt Version', analysis.promptVersion ?? 'v2'],
        ['Artifacts',     `${analysis.artifacts.length} generated`],
        ['Completed At',  analysis.completedAt ? new Date(analysis.completedAt).toUTCString() : '—'],
        ['Tokens Used',   analysis.tokensTotal?.toLocaleString() ?? '—'],
      ];
      if (analysis.requirement?.title) {
        meta.unshift(['Requirement', analysis.requirement.title]);
      }

      doc.rect(M, mY - 8, CW, meta.length * 26 + 16)
        .fill(B.bg).stroke(B.border);

      meta.forEach(([k, v], i) => {
        const y = mY + i * 26;
        doc.fillColor(B.muted).font('Helvetica-Bold').fontSize(9)
          .text(k.toUpperCase(), M + 10, y + 6, { width: 130 });
        doc.fillColor(B.text).font('Helvetica').fontSize(10)
          .text(v, M + 150, y + 5, { width: CW - 160 });
      });

      // bottom disclaimer
      doc.fillColor(B.muted).font('Helvetica-Oblique').fontSize(8)
        .text(
          `Generated by ReqAI on ${new Date().toUTCString()}. AI-generated content — review before use.`,
          M, H - 52, { width: CW, align: 'center' },
        );

      // ── TABLE OF CONTENTS ─────────────────────────────────────────────────

      doc.addPage();
      sectionHeader('Table of Contents');
      doc.moveDown(0.5);

      analysis.artifacts.forEach((a, i) => {
        const title = ARTIFACT_TITLES[a.artifactType] ?? a.artifactType;
        const y     = doc.y;
        const dots  = '·'.repeat(60);
        doc.fillColor(B.text).font('Helvetica').fontSize(11)
          .text(`${i + 1}.   ${title}`, M + 10, y, { lineBreak: false });
        doc.fillColor(B.border).fontSize(9)
          .text(dots, M + 10 + doc.widthOfString(`${i + 1}.   ${title}`) + 4, y + 2, { lineBreak: false });
        if (a.confidenceScore != null) {
          const pct = Math.round(a.confidenceScore * 100);
          const col = pct >= 80 ? B.success : pct >= 60 ? B.warning : B.danger;
          doc.fillColor(col).font('Helvetica-Bold').fontSize(9)
            .text(`${pct}%`, W - M - 30, y);
        }
        doc.moveDown(0.7);
        if (doc.y > H - 60) { doc.addPage(); }
      });

      // ── ARTIFACT SECTIONS ─────────────────────────────────────────────────

      for (const artifact of analysis.artifacts) {
        doc.addPage();
        sectionHeader(ARTIFACT_TITLES[artifact.artifactType] ?? artifact.artifactType);
        confidence(artifact.confidenceScore);
        doc.moveDown(0.3);
        this.pdfArtifact(doc, artifact, { body, kv, bullet, subheading, hr, badge, needPage, M, CW });
      }

      // ── PAGE NUMBERS ──────────────────────────────────────────────────────

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const { width, height } = doc.page;
        doc.rect(0, height - 32, width, 32).fill(B.dark);
        doc.fillColor(B.muted).font('Helvetica').fontSize(8)
          .text(
            `ReqAI  ·  Analysis ${analysis.id.slice(0, 8).toUpperCase()}  ·  Page ${i - range.start + 1} of ${range.count}`,
            0, height - 19, { align: 'center', width },
          );
      }

      doc.end();
    });
  }

  // ── PDF artifact router ────────────────────────────────────────────────────

  private pdfArtifact(
    doc: PDFKit.PDFDocument,
    artifact: ArtifactDoc,
    h: {
      body: (t: string) => void; kv: (k: string, v: string) => void;
      bullet: (t: string) => void; subheading: (t: string) => void;
      hr: () => void; badge: (t: string, bg: string) => void;
      needPage: (n?: number) => void; M: number; CW: number;
    },
  ) {
    const c = artifact.content ?? {};
    const { body, kv, bullet, subheading, hr, badge, needPage } = h;

    switch (artifact.artifactType) {

      case 'SUMMARY':
        body(c.executive ?? '');
        if (c.scope) { subheading('Scope'); body(c.scope); }
        if (Array.isArray(c.keyPoints)) { subheading('Key Points'); c.keyPoints.forEach((p: string) => bullet(p)); }
        if (c.complexity) {
          subheading('Complexity');
          kv('Level',     c.complexity.level   ?? '');
          kv('Score',     String(c.complexity.score ?? ''));
          body(c.complexity.reasoning ?? '');
        }
        break;

      case 'FUNCTIONAL_REQUIREMENTS':
        (c.requirements ?? []).forEach((r: any, i: number) => {
          needPage();
          subheading(`FR-${String(i + 1).padStart(3, '0')}: ${r.title ?? ''}`);
          kv('Priority', r.priority ?? ''); kv('Category', r.category ?? '');
          body(r.description ?? '');
          if (Array.isArray(r.acceptanceCriteria)) r.acceptanceCriteria.forEach((ac: string) => bullet(ac));
          hr();
        });
        break;

      case 'NON_FUNCTIONAL_REQUIREMENTS':
        (c.requirements ?? []).forEach((r: any) => {
          needPage();
          subheading(`[${r.category ?? 'NFR'}] ${r.title ?? ''}`);
          kv('Metric', r.metric ?? ''); kv('Threshold', r.threshold ?? '');
          body(r.description ?? ''); hr();
        });
        break;

      case 'BUSINESS_RULES':
        (c.rules ?? []).forEach((r: any, i: number) => {
          needPage();
          subheading(`BR-${String(i + 1).padStart(3, '0')}: ${r.name ?? r.title ?? ''}`);
          body(r.description ?? '');
          if (r.rationale) kv('Rationale', r.rationale);
          hr();
        });
        break;

      case 'ACTORS':
        (c.actors ?? []).forEach((a: any) => {
          needPage();
          subheading(`${a.name ?? ''} (${a.type ?? ''})`);
          body(a.description ?? '');
          if (Array.isArray(a.permissions)) kv('Permissions', a.permissions.join(', '));
          hr();
        });
        break;

      case 'APIS':
        (c.endpoints ?? []).forEach((ep: any) => {
          needPage(100);
          badge(`${ep.method ?? 'GET'}  ${ep.path ?? '/'}`, B.primary);
          kv('Summary', ep.summary ?? '');
          kv('Auth',    ep.auth ?? (ep.authRequired ? 'Required' : 'None'));
          if (ep.requestBody) kv('Request Body', JSON.stringify(ep.requestBody, null, 0));
          if (Array.isArray(ep.queryParams)) ep.queryParams.forEach((p: any) =>
            bullet(`${p.name} (${p.type})${p.required ? ' *' : ''} — ${p.description ?? ''}`));
          hr();
        });
        break;

      case 'DATABASE_TABLES':
        (c.tables ?? []).forEach((tbl: any) => {
          needPage(120);
          subheading(`Table: ${tbl.tableName ?? tbl.name ?? ''}`);
          body(tbl.description ?? '');
          (tbl.columns ?? []).forEach((col: any) => {
            const flags = [col.primaryKey ? 'PK' : '', col.unique ? 'UNIQUE' : '', col.nullable ? 'NULL' : 'NOT NULL'].filter(Boolean).join(' · ');
            bullet(`${col.name}  —  ${col.type ?? ''}  [${flags}]  ${col.description ?? ''}`);
          });
          if (Array.isArray(tbl.indexes)) kv('Indexes', tbl.indexes.map((idx: any) => idx.name ?? idx).join(', '));
          hr();
        });
        break;

      case 'VALIDATION_RULES':
        (c.rules ?? []).forEach((r: any) => {
          needPage();
          subheading(`${r.entity ?? ''}.${r.field ?? ''} (${r.layer ?? 'ALL'})`);
          (r.validations ?? []).forEach((v: any) => bullet(`[${v.layer ?? 'ALL'}] ${v.rule}: ${v.message ?? ''}`));
          hr();
        });
        break;

      case 'ACCEPTANCE_CRITERIA':
        (c.criteria ?? []).forEach((ac: any, i: number) => {
          needPage();
          subheading(`Scenario ${i + 1}: ${ac.scenario ?? ac.title ?? ''}`);
          if (ac.given) kv('GIVEN', ac.given);
          if (ac.when)  kv('WHEN',  ac.when);
          if (ac.then)  kv('THEN',  ac.then);
          (ac.and ?? []).forEach((a: string) => kv('AND', a));
          hr();
        });
        break;

      case 'DEPENDENCIES':
        (c.dependencies ?? []).forEach((d: any) => {
          needPage();
          subheading(`[${d.type ?? 'INTERNAL'}] ${d.name ?? ''}`);
          body(d.description ?? '');
          if (d.version)  kv('Version',  d.version);
          if (d.impact)   kv('Impact',   d.impact);
          hr();
        });
        break;

      case 'RISKS':
        (c.risks ?? []).forEach((r: any, i: number) => {
          needPage();
          const level = r.overallRisk ?? r.severity ?? 'MEDIUM';
          const col   = level === 'CRITICAL' || level === 'HIGH' ? B.danger : level === 'MEDIUM' ? B.warning : B.success;
          badge(`[${level}] Risk-${String(i + 1).padStart(2, '0')}: ${r.title ?? ''}`, col);
          body(r.description ?? '');
          kv('Probability', String(r.probability ?? ''));
          kv('Impact',      String(r.impact ?? ''));
          kv('Risk Score',  String(r.riskScore ?? ''));
          if (r.mitigation) kv('Mitigation', r.mitigation);
          hr();
        });
        break;

      case 'OPEN_QUESTIONS':
        (c.questions ?? []).forEach((q: any, i: number) => {
          needPage();
          subheading(`Q${i + 1} [${q.priority ?? 'MEDIUM'}]: ${q.question ?? ''}`);
          if (q.impact)          kv('Impact', q.impact);
          if (q.suggestedOwner)  kv('Owner',  q.suggestedOwner);
          hr();
        });
        break;

      case 'DEVELOPMENT_TASKS':
        (c.tasks ?? []).forEach((t: any, i: number) => {
          needPage();
          subheading(`TASK-${String(i + 1).padStart(3, '0')}: ${t.title ?? ''}`);
          kv('Layer',  t.layer    ?? ''); kv('Priority', t.priority  ?? '');
          kv('Points', String(t.storyPoints ?? ''));
          body(t.description ?? '');
          (t.acceptanceCriteria ?? []).forEach((ac: string) => bullet(ac));
          hr();
        });
        break;

      case 'STORY_POINTS':
        kv('Total Points',      String(c.totalPoints       ?? ''));
        kv('Recommended Sprints', String(c.recommendedSprints ?? ''));
        kv('Team Velocity',     String(c.teamVelocity      ?? ''));
        (c.sprintPlan ?? []).forEach((sprint: any) => {
          needPage();
          subheading(`Sprint ${sprint.sprintNumber}: ${sprint.focus ?? ''} (${sprint.totalPoints ?? 0} pts)`);
          (sprint.tasks ?? []).forEach((t: any) => bullet(`${t.taskId ?? ''}: ${t.title ?? ''} (${t.points ?? 0} pts)`));
        });
        break;

      default:
        body(JSON.stringify(c, null, 2));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  DOCX BUILDER (docx library)
  // ═══════════════════════════════════════════════════════════════════════════

  private async buildDocx(analysis: AnalysisDoc): Promise<Buffer> {
    const sections = analysis.artifacts.flatMap((a) => this.docxArtifact(a));

    const doc = new Document({
      creator:     'ReqAI – AI Requirement Analyzer',
      title:       'Analysis Report',
      description: `Analysis ${analysis.id}`,
      styles: {
        default: {
          document: {
            run:       { font: 'Calibri', size: 22 },
            paragraph: { spacing: { line: 276 } },
          },
        },
        paragraphStyles: [
          {
            id:   'Heading1',
            name: 'Heading 1',
            run:  { font: 'Calibri', size: 32, bold: true, color: '1A1A2E' },
          },
          {
            id:   'Heading2',
            name: 'Heading 2',
            run:  { font: 'Calibri', size: 26, bold: true, color: '6C63FF' },
          },
          {
            id:   'Heading3',
            name: 'Heading 3',
            run:  { font: 'Calibri', size: 22, bold: true, color: '1F2328' },
          },
        ],
      },
      sections: [
        {
          properties: {},
          children: [
            // Title
            new Paragraph({
              heading: HeadingLevel.TITLE,
              children: [new TextRun({ text: 'ReqAI — Analysis Report', bold: true, size: 48, font: 'Calibri' })],
              spacing: { after: 400 },
            }),
            // Subtitle / meta
            ...this.docxMetaTable(analysis),
            new Paragraph({ children: [new PageBreak()] }),
            // Artifact sections
            ...sections,
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  private docxMetaTable(analysis: AnalysisDoc): Paragraph[] {
    const rows: [string, string][] = [
      ['Analysis ID',    analysis.id],
      ['AI Provider',    `${analysis.aiProvider} / ${analysis.aiModel}`],
      ['Prompt Version', analysis.promptVersion ?? 'v2'],
      ['Artifacts',      `${analysis.artifacts.length} generated`],
      ['Completed At',   analysis.completedAt ? new Date(analysis.completedAt).toUTCString() : '—'],
      ['Tokens Used',    analysis.tokensTotal?.toLocaleString() ?? '—'],
    ];
    if (analysis.requirement?.title) {
      rows.unshift(['Requirement', analysis.requirement.title]);
    }
    return rows.map(([k, v]) =>
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: `${k}: `, bold: true, size: 20, color: '57606A' }),
          new TextRun({ text: v,        size: 20 }),
        ],
      }),
    );
  }

  private docxArtifact(artifact: ArtifactDoc): Paragraph[] {
    const title = ARTIFACT_TITLES[artifact.artifactType] ?? artifact.artifactType;
    const c = artifact.content ?? {};
    const paras: Paragraph[] = [];

    const h1 = (text: string): Paragraph =>
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, bold: true, size: 32, color: '1A1A2E' })], spacing: { before: 360, after: 120 } });

    const h2 = (text: string): Paragraph =>
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text, bold: true, size: 26, color: '6C63FF' })], spacing: { before: 240, after: 80 } });

    const h3 = (text: string): Paragraph =>
      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text, bold: true, size: 22 })], spacing: { before: 160, after: 60 } });

    const body = (text: string): Paragraph =>
      new Paragraph({ children: [new TextRun({ text, size: 22 })], spacing: { after: 80 } });

    const kv = (key: string, val: string): Paragraph =>
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: `${key}: `, bold: true, size: 20, color: '57606A' }),
          new TextRun({ text: val, size: 20 }),
        ],
      });

    const bullet = (text: string): Paragraph =>
      new Paragraph({
        bullet:   { level: 0 },
        children: [new TextRun({ text, size: 20 })],
        spacing:  { after: 40 },
      });

    const divider = (): Paragraph =>
      new Paragraph({ children: [new TextRun({ text: '─'.repeat(60), size: 16, color: 'E5E7EB' })], spacing: { after: 80 } });

    paras.push(h1(title));

    if (artifact.confidenceScore != null) {
      paras.push(kv('Confidence', `${Math.round(artifact.confidenceScore * 100)}%`));
    }

    switch (artifact.artifactType) {
      case 'SUMMARY':
        if (c.executive) { paras.push(h2('Executive Summary'), body(c.executive)); }
        if (c.scope)      { paras.push(h2('Scope'),             body(c.scope)); }
        if (Array.isArray(c.keyPoints) && c.keyPoints.length) {
          paras.push(h2('Key Points'), ...c.keyPoints.map((p: string) => bullet(p)));
        }
        if (c.complexity) {
          paras.push(h2('Complexity'), kv('Level', c.complexity.level ?? ''), kv('Score', String(c.complexity.score ?? '')));
          if (c.complexity.reasoning) paras.push(body(c.complexity.reasoning));
        }
        break;

      case 'FUNCTIONAL_REQUIREMENTS':
        (c.requirements ?? []).forEach((r: any, i: number) => {
          paras.push(h2(`FR-${String(i + 1).padStart(3, '0')}: ${r.title ?? ''}`));
          paras.push(kv('Priority', r.priority ?? ''), kv('Category', r.category ?? ''));
          if (r.description) paras.push(body(r.description));
          if (Array.isArray(r.acceptanceCriteria)) r.acceptanceCriteria.forEach((ac: string) => paras.push(bullet(ac)));
          paras.push(divider());
        });
        break;

      case 'NON_FUNCTIONAL_REQUIREMENTS':
        (c.requirements ?? []).forEach((r: any) => {
          paras.push(h2(`[${r.category ?? 'NFR'}] ${r.title ?? ''}`));
          paras.push(kv('Metric', r.metric ?? ''), kv('Threshold', r.threshold ?? ''));
          if (r.description) paras.push(body(r.description));
          paras.push(divider());
        });
        break;

      case 'BUSINESS_RULES':
        (c.rules ?? []).forEach((r: any, i: number) => {
          paras.push(h2(`BR-${String(i + 1).padStart(3, '0')}: ${r.name ?? r.title ?? ''}`));
          if (r.description) paras.push(body(r.description));
          if (r.rationale)   paras.push(kv('Rationale', r.rationale));
          paras.push(divider());
        });
        break;

      case 'ACTORS':
        (c.actors ?? []).forEach((a: any) => {
          paras.push(h2(`${a.name ?? ''} (${a.type ?? ''})`));
          if (a.description) paras.push(body(a.description));
          if (Array.isArray(a.permissions)) paras.push(kv('Permissions', a.permissions.join(', ')));
          paras.push(divider());
        });
        break;

      case 'APIS':
        (c.endpoints ?? []).forEach((ep: any) => {
          paras.push(h2(`${ep.method ?? 'GET'}  ${ep.path ?? '/'}`));
          if (ep.summary) paras.push(body(ep.summary));
          paras.push(kv('Auth', ep.auth ?? (ep.authRequired ? 'Required' : 'None')));
          if (Array.isArray(ep.queryParams)) ep.queryParams.forEach((p: any) =>
            paras.push(bullet(`${p.name} (${p.type})${p.required ? ' *' : ''} — ${p.description ?? ''}`)));
          if (ep.requestBody) paras.push(kv('Request Body', JSON.stringify(ep.requestBody, null, 0)));
          paras.push(divider());
        });
        break;

      case 'DATABASE_TABLES':
        (c.tables ?? []).forEach((tbl: any) => {
          paras.push(h2(`Table: ${tbl.tableName ?? tbl.name ?? ''}`));
          if (tbl.description) paras.push(body(tbl.description));
          (tbl.columns ?? []).forEach((col: any) => {
            const flags = [col.primaryKey ? 'PK' : '', col.unique ? 'UNIQUE' : '', col.nullable ? 'NULL' : 'NOT NULL'].filter(Boolean).join(' · ');
            paras.push(bullet(`${col.name} — ${col.type ?? ''} [${flags}] ${col.description ?? ''}`));
          });
          if (Array.isArray(tbl.indexes)) paras.push(kv('Indexes', tbl.indexes.map((i: any) => i.name ?? i).join(', ')));
          paras.push(divider());
        });
        break;

      case 'VALIDATION_RULES':
        (c.rules ?? []).forEach((r: any) => {
          paras.push(h2(`${r.entity ?? ''}.${r.field ?? ''} (${r.layer ?? 'ALL'})`));
          (r.validations ?? []).forEach((v: any) => paras.push(bullet(`[${v.layer ?? 'ALL'}] ${v.rule}: ${v.message ?? ''}`)));
          paras.push(divider());
        });
        break;

      case 'ACCEPTANCE_CRITERIA':
        (c.criteria ?? []).forEach((ac: any, i: number) => {
          paras.push(h2(`Scenario ${i + 1}: ${ac.scenario ?? ac.title ?? ''}`));
          if (ac.given) paras.push(kv('GIVEN', ac.given));
          if (ac.when)  paras.push(kv('WHEN',  ac.when));
          if (ac.then)  paras.push(kv('THEN',  ac.then));
          (ac.and ?? []).forEach((a: string) => paras.push(kv('AND', a)));
          paras.push(divider());
        });
        break;

      case 'DEPENDENCIES':
        (c.dependencies ?? []).forEach((d: any) => {
          paras.push(h2(`[${d.type ?? 'INTERNAL'}] ${d.name ?? ''}`));
          if (d.description) paras.push(body(d.description));
          if (d.version)     paras.push(kv('Version',  d.version));
          if (d.impact)      paras.push(kv('Impact',   d.impact));
          paras.push(divider());
        });
        break;

      case 'RISKS':
        (c.risks ?? []).forEach((r: any, i: number) => {
          const level = r.overallRisk ?? r.severity ?? 'MEDIUM';
          paras.push(h2(`[${level}] Risk-${String(i + 1).padStart(2, '0')}: ${r.title ?? ''}`));
          if (r.description) paras.push(body(r.description));
          paras.push(kv('Probability', String(r.probability ?? '')), kv('Impact', String(r.impact ?? '')), kv('Score', String(r.riskScore ?? '')));
          if (r.mitigation) paras.push(kv('Mitigation', r.mitigation));
          paras.push(divider());
        });
        break;

      case 'OPEN_QUESTIONS':
        (c.questions ?? []).forEach((q: any, i: number) => {
          paras.push(h2(`Q${i + 1} [${q.priority ?? 'MEDIUM'}]: ${q.question ?? ''}`));
          if (q.impact)         paras.push(kv('Impact',    q.impact));
          if (q.suggestedOwner) paras.push(kv('Owner',     q.suggestedOwner));
          paras.push(divider());
        });
        break;

      case 'DEVELOPMENT_TASKS':
        (c.tasks ?? []).forEach((t: any, i: number) => {
          paras.push(h2(`TASK-${String(i + 1).padStart(3, '0')}: ${t.title ?? ''}`));
          paras.push(kv('Layer', t.layer ?? ''), kv('Priority', t.priority ?? ''), kv('Story Points', String(t.storyPoints ?? '')));
          if (t.description) paras.push(body(t.description));
          (t.acceptanceCriteria ?? []).forEach((ac: string) => paras.push(bullet(ac)));
          paras.push(divider());
        });
        break;

      case 'STORY_POINTS':
        paras.push(kv('Total Points', String(c.totalPoints ?? '')), kv('Recommended Sprints', String(c.recommendedSprints ?? '')), kv('Team Velocity', String(c.teamVelocity ?? '')));
        (c.sprintPlan ?? []).forEach((sprint: any) => {
          paras.push(h3(`Sprint ${sprint.sprintNumber}: ${sprint.focus ?? ''} (${sprint.totalPoints ?? 0} pts)`));
          (sprint.tasks ?? []).forEach((t: any) => paras.push(bullet(`${t.taskId ?? ''}: ${t.title ?? ''} (${t.points ?? 0} pts)`)));
        });
        break;

      default:
        paras.push(body(JSON.stringify(c, null, 2)));
    }

    return paras;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MARKDOWN BUILDER
  // ═══════════════════════════════════════════════════════════════════════════

  private buildMarkdown(analysis: AnalysisDoc): string {
    const lines: string[] = [
      '# ReqAI — Analysis Report',
      '',
      '> **AI-generated content.** Review all artifacts before use in production.',
      '',
      '## Metadata',
      '',
      `| Field | Value |`,
      `|---|---|`,
      `| Analysis ID | \`${analysis.id}\` |`,
      `| AI Provider | ${analysis.aiProvider} / ${analysis.aiModel} |`,
      `| Prompt Version | ${analysis.promptVersion ?? 'v2'} |`,
      `| Artifacts | ${analysis.artifacts.length} generated |`,
      `| Completed At | ${analysis.completedAt ? new Date(analysis.completedAt).toUTCString() : '—'} |`,
      `| Tokens Used | ${analysis.tokensTotal?.toLocaleString() ?? '—'} |`,
      `| Cost | ${analysis.costUsd != null ? '$' + Number(analysis.costUsd).toFixed(6) : '—'} |`,
      '',
    ];

    if (analysis.requirement?.title) {
      lines.push('## Requirement', '', `**${analysis.requirement.title}**`, '', analysis.requirement.body ?? '', '', '---', '');
    }

    for (const artifact of analysis.artifacts) {
      const title = ARTIFACT_TITLES[artifact.artifactType] ?? artifact.artifactType;
      const conf  = artifact.confidenceScore != null
        ? ` _(${Math.round(artifact.confidenceScore * 100)}% confidence)_`
        : '';
      lines.push(`## ${title}${conf}`, '');
      lines.push(this.markdownArtifact(artifact));
      lines.push('', '---', '');
    }

    return lines.join('\n');
  }

  private markdownArtifact(artifact: ArtifactDoc): string {
    const c = artifact.content ?? {};
    const lines: string[] = [];

    switch (artifact.artifactType) {
      case 'SUMMARY':
        if (c.executive) lines.push('### Executive Summary', '', c.executive, '');
        if (c.scope)     lines.push('### Scope', '', c.scope, '');
        if (Array.isArray(c.keyPoints) && c.keyPoints.length) {
          lines.push('### Key Points', '');
          c.keyPoints.forEach((p: string) => lines.push(`- ${p}`));
        }
        if (c.complexity) {
          lines.push('', '### Complexity', '', `**Level:** ${c.complexity.level ?? ''}  |  **Score:** ${c.complexity.score ?? ''}/100`, '');
          if (c.complexity.reasoning) lines.push(c.complexity.reasoning);
        }
        break;

      case 'FUNCTIONAL_REQUIREMENTS':
        (c.requirements ?? []).forEach((r: any, i: number) => {
          lines.push(`### FR-${String(i + 1).padStart(3, '0')}: ${r.title ?? ''}`);
          lines.push(`**Priority:** ${r.priority ?? ''}  |  **Category:** ${r.category ?? ''}`, '');
          if (r.description) lines.push(r.description, '');
          if (Array.isArray(r.acceptanceCriteria) && r.acceptanceCriteria.length) {
            lines.push('**Acceptance Criteria:**');
            r.acceptanceCriteria.forEach((ac: string) => lines.push(`- ${ac}`));
          }
          lines.push('');
        });
        break;

      case 'NON_FUNCTIONAL_REQUIREMENTS':
        (c.requirements ?? []).forEach((r: any) => {
          lines.push(`### [${r.category ?? 'NFR'}] ${r.title ?? ''}`);
          lines.push(`**Metric:** ${r.metric ?? ''}  |  **Threshold:** ${r.threshold ?? ''}`, '');
          if (r.description) lines.push(r.description, '');
        });
        break;

      case 'BUSINESS_RULES':
        (c.rules ?? []).forEach((r: any, i: number) => {
          lines.push(`### BR-${String(i + 1).padStart(3, '0')}: ${r.name ?? r.title ?? ''}`);
          if (r.description) lines.push(r.description, '');
          if (r.rationale)   lines.push(`> **Rationale:** ${r.rationale}`, '');
        });
        break;

      case 'ACTORS':
        (c.actors ?? []).forEach((a: any) => {
          lines.push(`### ${a.name ?? ''} (${a.type ?? ''})`);
          if (a.description) lines.push(a.description, '');
          if (Array.isArray(a.permissions) && a.permissions.length) lines.push(`**Permissions:** ${a.permissions.join(', ')}`, '');
        });
        break;

      case 'APIS':
        (c.endpoints ?? []).forEach((ep: any) => {
          lines.push(`### \`${ep.method ?? 'GET'} ${ep.path ?? '/'}\``);
          if (ep.summary) lines.push(ep.summary, '');
          lines.push(`**Auth:** ${ep.auth ?? (ep.authRequired ? 'Required' : 'None')}`, '');
          if (Array.isArray(ep.queryParams) && ep.queryParams.length) {
            lines.push('**Query Parameters:**');
            ep.queryParams.forEach((p: any) => lines.push(`- \`${p.name}\` (${p.type})${p.required ? ' \\*' : ''} — ${p.description ?? ''}`));
            lines.push('');
          }
          if (ep.requestBody) {
            lines.push('**Request Body:**', '```json', JSON.stringify(ep.requestBody, null, 2), '```', '');
          }
          if (Array.isArray(ep.errorCodes) && ep.errorCodes.length) {
            lines.push('**Error Codes:**');
            ep.errorCodes.forEach((e: any) => lines.push(`- \`${e.status ?? e}\`: ${e.message ?? ''}`));
            lines.push('');
          }
        });
        break;

      case 'DATABASE_TABLES':
        (c.tables ?? []).forEach((tbl: any) => {
          lines.push(`### Table: \`${tbl.tableName ?? tbl.name ?? ''}\``);
          if (tbl.description) lines.push(tbl.description, '');
          if (Array.isArray(tbl.columns) && tbl.columns.length) {
            lines.push('| Column | Type | PK | Nullable | Description |');
            lines.push('|--------|------|----|----------|-------------|');
            tbl.columns.forEach((col: any) =>
              lines.push(`| \`${col.name}\` | \`${col.type ?? ''}\` | ${col.primaryKey ? '✓' : ''} | ${col.nullable ? 'YES' : 'NO'} | ${col.description ?? ''} |`));
            lines.push('');
          }
          if (Array.isArray(tbl.indexes) && tbl.indexes.length) {
            lines.push('**Indexes:**');
            tbl.indexes.forEach((idx: any) => lines.push(`- \`${idx.name ?? idx}\`: ${(idx.columns ?? []).join(', ')} (${idx.type ?? 'BTREE'})`));
            lines.push('');
          }
        });
        break;

      case 'VALIDATION_RULES':
        (c.rules ?? []).forEach((r: any) => {
          lines.push(`### \`${r.entity ?? ''}.${r.field ?? ''}\` (${r.layer ?? 'ALL'})`);
          (r.validations ?? []).forEach((v: any) => lines.push(`- \`[${v.layer ?? 'ALL'}]\` ${v.rule}: ${v.message ?? ''}`));
          lines.push('');
        });
        break;

      case 'ACCEPTANCE_CRITERIA':
        (c.criteria ?? []).forEach((ac: any, i: number) => {
          lines.push(`### Scenario ${i + 1}: ${ac.scenario ?? ac.title ?? ''}`);
          if (ac.given) lines.push(`**Given** ${ac.given}`);
          if (ac.when)  lines.push(`**When** ${ac.when}`);
          if (ac.then)  lines.push(`**Then** ${ac.then}`);
          (ac.and ?? []).forEach((a: string) => lines.push(`**And** ${a}`));
          lines.push('');
        });
        break;

      case 'DEPENDENCIES':
        (c.dependencies ?? []).forEach((d: any) => {
          lines.push(`### [${d.type ?? 'INTERNAL'}] ${d.name ?? ''}`);
          if (d.description) lines.push(d.description, '');
          if (d.version) lines.push(`**Version:** \`${d.version}\``);
          if (d.impact)  lines.push(`**Impact:** ${d.impact}`);
          lines.push('');
        });
        break;

      case 'RISKS':
        (c.risks ?? []).forEach((r: any, i: number) => {
          const level = r.overallRisk ?? r.severity ?? 'MEDIUM';
          const score = r.riskScore ?? '';
          lines.push(`### [${level}] Risk-${String(i + 1).padStart(2, '0')}: ${r.title ?? ''}`);
          lines.push(`**Probability:** ${r.probability ?? ''}  |  **Impact:** ${r.impact ?? ''}  |  **Score:** ${score}`, '');
          if (r.description) lines.push(r.description, '');
          if (r.mitigation)  lines.push(`> **Mitigation:** ${r.mitigation}`, '');
          if (r.owner)       lines.push(`> **Owner:** ${r.owner}`, '');
        });
        break;

      case 'OPEN_QUESTIONS':
        (c.questions ?? []).forEach((q: any, i: number) => {
          lines.push(`### Q${i + 1} [${q.priority ?? 'MEDIUM'}]: ${q.question ?? ''}`);
          if (q.impact)         lines.push(`**Impact:** ${q.impact}`, '');
          if (q.suggestedOwner) lines.push(`**Owner:** ${q.suggestedOwner}`, '');
          if (q.category)       lines.push(`**Category:** ${q.category}`, '');
        });
        break;

      case 'DEVELOPMENT_TASKS':
        (c.tasks ?? []).forEach((t: any, i: number) => {
          lines.push(`### TASK-${String(i + 1).padStart(3, '0')}: ${t.title ?? ''}`);
          lines.push(`**Layer:** ${t.layer ?? ''}  |  **Priority:** ${t.priority ?? ''}  |  **Story Points:** ${t.storyPoints ?? ''}`, '');
          if (t.description) lines.push(t.description, '');
          if (Array.isArray(t.acceptanceCriteria) && t.acceptanceCriteria.length) {
            t.acceptanceCriteria.forEach((ac: string) => lines.push(`- ${ac}`));
          }
          lines.push('');
        });
        break;

      case 'STORY_POINTS':
        lines.push(`**Total Points:** ${c.totalPoints ?? ''}  |  **Sprints:** ${c.recommendedSprints ?? ''}  |  **Velocity:** ${c.teamVelocity ?? ''} pts/sprint`, '');
        (c.sprintPlan ?? []).forEach((sprint: any) => {
          lines.push(`#### Sprint ${sprint.sprintNumber}: ${sprint.focus ?? ''} (${sprint.totalPoints ?? 0} pts)`);
          (sprint.tasks ?? []).forEach((t: any) => lines.push(`- ${t.taskId ?? ''}: ${t.title ?? ''} (${t.points ?? 0} pts)`));
          lines.push('');
        });
        if (Array.isArray(c.breakdown) && c.breakdown.length) {
          lines.push('#### Breakdown by Layer');
          c.breakdown.forEach((b: any) => lines.push(`- **${b.layer}**: ${b.points} pts (${b.taskCount} tasks)`));
        }
        break;

      default:
        lines.push('```json', JSON.stringify(c, null, 2), '```');
    }

    return lines.join('\n');
  }
}
