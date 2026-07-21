import Bull from 'bull';
import { db } from '../database/connection';
import { AIProviderFactory } from '../ai/AIProviderFactory';
import { PromptBuilder } from '../ai/PromptBuilder';
import { AnalysisRepository } from '../repositories/analysis.repository';
import { RequirementRepository } from '../repositories/requirement.repository';
import { logger } from '../../shared/logger';

// ─── Artifact type map ────────────────────────────────────────────────────────
//
// Maps DB artifact_type enum values (SCREAMING_SNAKE_CASE)
// → JSON keys returned by PromptBuilder v2 (camelCase).
//
// Source of truth for DB enum: migration 012_migrate_artifact_type_enum_v2.sql
// Source of truth for JSON keys: PromptBuilder.ts (buildSystemPrompt schema)
//
const ARTIFACT_MAP: Record<string, string> = {
  SUMMARY:                      'summary',
  FUNCTIONAL_REQUIREMENTS:      'functionalRequirements',
  NON_FUNCTIONAL_REQUIREMENTS:  'nonFunctionalRequirements',
  BUSINESS_RULES:               'businessRules',
  ACTORS:                       'actors',
  APIS:                         'apis',
  DATABASE_TABLES:              'databaseTables',
  VALIDATION_RULES:             'validationRules',
  ACCEPTANCE_CRITERIA:          'acceptanceCriteria',
  DEPENDENCIES:                 'dependencies',
  RISKS:                        'risks',
  OPEN_QUESTIONS:               'openQuestions',
  DEVELOPMENT_TASKS:            'developmentTasks',
  STORY_POINTS:                 'storyPoints',
};

// ─── Confidence heuristics ────────────────────────────────────────────────────
//
// Each heuristic reads a structural signal from the parsed artifact content and
// returns a confidence float (0.0–1.0) stored alongside the artifact.
// These are best-effort estimates — not AI self-reported confidence scores.
//
function inferConfidence(artifactType: string, content: Record<string, unknown>): number {
  try {
    switch (artifactType) {
      // ── SUMMARY: confidence based on presence of all top-level fields ──────
      case 'SUMMARY': {
        const required = ['title', 'overview', 'scope', 'outOfScope', 'keyPoints', 'complexity', 'complexityScore'];
        const present  = required.filter(k => (content as any)[k] != null).length;
        return present >= 6 ? 0.95 : present >= 4 ? 0.80 : 0.60;
      }

      // ── FUNCTIONAL_REQUIREMENTS: count of requirements ────────────────────
      case 'FUNCTIONAL_REQUIREMENTS': {
        const reqs = (content as any).requirements ?? [];
        return reqs.length >= 5 ? 0.92 : reqs.length >= 3 ? 0.80 : reqs.length >= 1 ? 0.65 : 0.40;
      }

      // ── NON_FUNCTIONAL_REQUIREMENTS: count + metric presence ──────────────
      case 'NON_FUNCTIONAL_REQUIREMENTS': {
        const reqs    = (content as any).requirements ?? [];
        const withMetrics = reqs.filter((r: any) => r.metric && r.metric.length > 10).length;
        if (reqs.length === 0) return 0.40;
        return withMetrics / reqs.length >= 0.8 ? 0.90 : 0.72;
      }

      // ── BUSINESS_RULES: count of rules ────────────────────────────────────
      case 'BUSINESS_RULES': {
        const rules = (content as any).rules ?? [];
        return rules.length >= 3 ? 0.88 : rules.length >= 1 ? 0.72 : 0.50;
      }

      // ── ACTORS: count of identified actors ───────────────────────────────
      case 'ACTORS': {
        const actors = (content as any).actors ?? [];
        return actors.length >= 3 ? 0.90 : actors.length >= 1 ? 0.75 : 0.45;
      }

      // ── APIS: count of endpoints ──────────────────────────────────────────
      case 'APIS': {
        const endpoints = (content as any).endpoints ?? [];
        return endpoints.length >= 4 ? 0.90 : endpoints.length >= 2 ? 0.78 : endpoints.length >= 1 ? 0.65 : 0.40;
      }

      // ── DATABASE_TABLES: count of tables with columns ────────────────────
      case 'DATABASE_TABLES': {
        const tables       = (content as any).tables ?? [];
        const withColumns  = tables.filter((t: any) => Array.isArray(t.columns) && t.columns.length > 0).length;
        if (tables.length === 0) return 0.40;
        return withColumns === tables.length ? 0.92 : 0.70;
      }

      // ── VALIDATION_RULES: count of rules ─────────────────────────────────
      case 'VALIDATION_RULES': {
        const rules = (content as any).rules ?? [];
        return rules.length >= 5 ? 0.88 : rules.length >= 2 ? 0.74 : rules.length >= 1 ? 0.60 : 0.40;
      }

      // ── ACCEPTANCE_CRITERIA: count + testable flag ────────────────────────
      case 'ACCEPTANCE_CRITERIA': {
        const criteria     = (content as any).criteria ?? [];
        const testable     = criteria.filter((c: any) => c.testable === true).length;
        if (criteria.length === 0) return 0.40;
        return criteria.length >= 4 && testable / criteria.length >= 0.8 ? 0.92
          : criteria.length >= 2 ? 0.76
          : 0.58;
      }

      // ── DEPENDENCIES: count of dependencies ──────────────────────────────
      case 'DEPENDENCIES': {
        const deps = (content as any).dependencies ?? [];
        return deps.length >= 3 ? 0.85 : deps.length >= 1 ? 0.72 : 0.50;
      }

      // ── RISKS: risk score integrity ───────────────────────────────────────
      case 'RISKS': {
        const risks = (content as any).risks ?? [];
        if (risks.length === 0) return 0.50;
        const LEVEL: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        const validScores = risks.filter((r: any) => {
          const expected = (LEVEL[r.probability] ?? 0) * (LEVEL[r.impact] ?? 0);
          return expected > 0 && r.riskScore === expected;
        }).length;
        return validScores / risks.length >= 0.9 ? 0.92 : 0.72;
      }

      // ── OPEN_QUESTIONS: count of questions ───────────────────────────────
      case 'OPEN_QUESTIONS': {
        const questions = (content as any).questions ?? [];
        // Model is reliable at surfacing gaps — baseline confidence is higher
        return questions.length >= 3 ? 0.88 : questions.length >= 1 ? 0.80 : 0.60;
      }

      // ── DEVELOPMENT_TASKS: count + story point sum consistency ────────────
      case 'DEVELOPMENT_TASKS': {
        const tasks = (content as any).tasks ?? [];
        return tasks.length >= 5 ? 0.90 : tasks.length >= 3 ? 0.78 : tasks.length >= 1 ? 0.62 : 0.40;
      }

      // ── STORY_POINTS: verify totalPoints equals sum of task points ────────
      case 'STORY_POINTS': {
        const total     = (content as any).totalPoints as number | undefined;
        const breakdown = (content as any).breakdown as Record<string, number> | undefined;
        if (total == null || !breakdown) return 0.50;
        const breakdownSum = Object.values(breakdown).reduce((acc: number, v) => acc + (v ?? 0), 0);
        return total > 0 && Math.abs(breakdownSum - total) <= 1 ? 0.95 : 0.65;
      }

      default:
        return 0.80;
    }
  } catch {
    return 0.50;
  }
}

// ─── Job payload ─────────────────────────────────────────────────────────────

export interface AnalysisJobData {
  analysisId:    string;
  requirementId: string;
  /** Optional analyst-provided context passed at trigger time */
  context?:      string;
  /** Optional tech stack string (e.g. "Node.js, PostgreSQL, React") */
  techStack?:    string;
  /** Optional business domain (e.g. "fintech", "healthcare") */
  domain?:       string;
}

// ─── Worker factory ──────────────────────────────────────────────────────────

/**
 * Registers the Bull processor on the supplied queue.
 *
 * Separated from queue creation so the worker can be imported independently
 * (e.g. a dedicated worker process) without starting the HTTP server.
 *
 * Processing steps:
 *  1.  Mark analysis → PROCESSING
 *  2.  Fetch requirement from DB
 *  3.  Build system + user prompt (PromptBuilder v2)
 *  4.  Call AI provider
 *  5.  Parse AI JSON response
 *  6.  Validate all 14 artifact keys are present
 *  7.  Persist each artifact to the `artifacts` table
 *  8.  Record prompt_history row (tokens, cost, duration)
 *  9.  Mark analysis → COMPLETED (DB trigger syncs requirement.status)
 */
export function registerAnalysisWorker(queue: Bull.Queue): void {
  const promptBuilder   = new PromptBuilder();
  const analysisRepo    = new AnalysisRepository(db);
  const requirementRepo = new RequirementRepository(db);

  queue.process('analyze-requirement', async (job: Bull.Job<AnalysisJobData>) => {
    const { analysisId, requirementId, context, techStack, domain } = job.data;
    const startMs = Date.now();

    logger.info('Analysis worker started', { analysisId, requirementId, jobId: job.id });

    // ── 1. Mark analysis as PROCESSING ──────────────────────────────────────
    await db.query(
      `UPDATE analyses SET status = 'PROCESSING', started_at = NOW() WHERE id = $1`,
      [analysisId],
    );

    await job.progress(10);

    try {
      // ── 2. Fetch requirement ─────────────────────────────────────────────
      const requirement = await requirementRepo.findById(requirementId);
      if (!requirement) {
        throw new Error(`Requirement ${requirementId} not found`);
      }

      await job.progress(15);

      // ── 3. Build v2 prompts ──────────────────────────────────────────────
      const systemPrompt = promptBuilder.buildSystemPrompt();
      const userPrompt   = promptBuilder.buildUserPrompt({
        requirementTitle: requirement.title,
        requirementBody:  requirement.body,
        analystContext:   context,
        techStack,
        domain,
      });

      await job.progress(20);

      // ── 4. Call AI provider ──────────────────────────────────────────────
      const provider = AIProviderFactory.getProvider();
      const aiResult = await provider.complete({ systemPrompt, userPrompt });

      await job.progress(70);

      // ── 5. Parse AI response ─────────────────────────────────────────────
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(aiResult.text);
      } catch (parseErr) {
        throw new Error(`AI returned invalid JSON: ${(parseErr as Error).message}`);
      }

      await job.progress(75);

      // ── 6. Validate all 14 artifact keys are present ─────────────────────
      const expectedKeys = Object.values(ARTIFACT_MAP);
      const missingKeys  = expectedKeys.filter(k => parsed[k] == null);

      if (missingKeys.length > 0) {
        logger.warn('AI response missing artifact keys', {
          analysisId,
          missingKeys,
          presentKeys: expectedKeys.filter(k => parsed[k] != null),
        });
        // Non-fatal — persist what we have and log missing; do not throw.
      }

      await job.progress(80);

      // ── 7. Persist artifacts ─────────────────────────────────────────────
      const insertArtifact = async (dbType: string, jsonKey: string): Promise<void> => {
        const content = parsed[jsonKey];

        if (content == null || typeof content !== 'object' || Array.isArray(content)) {
          logger.warn('Skipping artifact — missing or invalid content', {
            analysisId,
            artifactType: dbType,
            jsonKey,
          });
          return;
        }

        const typedContent  = content as Record<string, unknown>;
        const confidence    = inferConfidence(dbType, typedContent);

        await db.query(
          `INSERT INTO artifacts (analysis_id, artifact_type, content, confidence_score)
           VALUES ($1, $2::artifact_type, $3, $4)
           ON CONFLICT (analysis_id, artifact_type) DO UPDATE
             SET content          = EXCLUDED.content,
                 confidence_score = EXCLUDED.confidence_score,
                 updated_at       = NOW()`,
          [analysisId, dbType, JSON.stringify(typedContent), confidence],
        );
      };

      await Promise.all(
        Object.entries(ARTIFACT_MAP).map(([dbType, jsonKey]) =>
          insertArtifact(dbType, jsonKey),
        ),
      );

      await job.progress(90);

      // ── 8. Record prompt history ─────────────────────────────────────────
      const durationMs = Date.now() - startMs;
      await db.query(
        `INSERT INTO prompt_history
           (analysis_id, prompt_version, system_prompt, user_prompt,
            tokens_prompt, tokens_completion, tokens_total, cost_usd,
            ai_provider, ai_model, duration_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          analysisId,
          'v2',                          // ← bumped from v1 to v2
          systemPrompt,
          userPrompt,
          aiResult.tokensPrompt,
          aiResult.tokensCompletion,
          aiResult.tokensTotal,
          aiResult.costUsd,
          provider.providerName,
          aiResult.model,
          durationMs,
        ],
      );

      // ── 9. Mark analysis COMPLETED ───────────────────────────────────────
      // DB trigger trg_analyses_sync_requirement auto-sets
      // requirements.status = 'ANALYZED' when status transitions to 'COMPLETED'.
      await db.query(
        `UPDATE analyses
         SET status            = 'COMPLETED',
             completed_at      = NOW(),
             tokens_prompt     = $2,
             tokens_completion = $3,
             tokens_total      = $4,
             cost_usd          = $5,
             duration_ms       = $6,
             ai_model          = $7,
             prompt_version    = 'v2'
         WHERE id = $1`,
        [
          analysisId,
          aiResult.tokensPrompt,
          aiResult.tokensCompletion,
          aiResult.tokensTotal,
          aiResult.costUsd,
          durationMs,
          aiResult.model,
        ],
      );

      await job.progress(100);

      logger.info('Analysis worker completed', {
        analysisId,
        requirementId,
        durationMs,
        artifactsWritten: Object.keys(ARTIFACT_MAP).length - missingKeys.length,
        missingArtifacts: missingKeys.length,
        tokensTotal:  aiResult.tokensTotal,
        costUsd:      aiResult.costUsd,
        provider:     provider.providerName,
        model:        aiResult.model,
      });
    } catch (err: any) {
      const durationMs  = Date.now() - startMs;
      const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 3) - 1;

      logger.error('Analysis worker failed', {
        analysisId,
        requirementId,
        jobId:        job.id,
        attempt:      job.attemptsMade + 1,
        error:        err.message,
        durationMs,
        isLastAttempt,
      });

      if (isLastAttempt) {
        // Permanent failure — mark the DB record so clients see FAILED status
        await db.query(
          `UPDATE analyses
           SET status        = 'FAILED',
               completed_at  = NOW(),
               duration_ms   = $2,
               error_code    = $3,
               error_message = $4
           WHERE id = $1`,
          [
            analysisId,
            durationMs,
            err.code ?? 'WORKER_ERROR',
            err.message?.substring(0, 500),
          ],
        );
      }

      // Re-throw so Bull can retry or move job to the failed queue
      throw err;
    }
  });

  logger.info('Analysis worker registered', {
    queue:       queue.name,
    concurrency: 1,
    artifactTypes: Object.keys(ARTIFACT_MAP).length,
    promptVersion: 'v2',
  });
}
