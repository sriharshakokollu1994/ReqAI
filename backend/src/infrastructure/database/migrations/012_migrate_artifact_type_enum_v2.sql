-- ============================================================
-- Migration 012 — Migrate artifact_type enum to v2 (14 types)
-- ReqAI – AI Requirement Analyzer
--
-- PromptBuilder v1 produced 9 artifact types:
--   USER_STORIES, ACCEPTANCE_CRITERIA, TEST_SCENARIOS,
--   NON_FUNCTIONAL_REQS, RISKS, TECHNICAL_NOTES,
--   COMPLEXITY_SCORE, SUMMARY, MISSING_INFO
--
-- PromptBuilder v2 produces 14 artifact types that match the
-- JSON keys returned by the AI (camelCase → SCREAMING_SNAKE DB enum):
--   SUMMARY, FUNCTIONAL_REQUIREMENTS, NON_FUNCTIONAL_REQUIREMENTS,
--   BUSINESS_RULES, ACTORS, APIS, DATABASE_TABLES,
--   VALIDATION_RULES, ACCEPTANCE_CRITERIA, DEPENDENCIES,
--   RISKS, OPEN_QUESTIONS, DEVELOPMENT_TASKS, STORY_POINTS
--
-- Strategy: PostgreSQL does not support removing enum values.
-- We rename the old type, create the new type, migrate rows,
-- then drop the old type.
-- ============================================================

BEGIN;

-- ── Step 1: Rename existing enum so we can create the new one ──────────────
ALTER TYPE artifact_type RENAME TO artifact_type_v1;

-- ── Step 2: Create the v2 enum with 14 values ──────────────────────────────
CREATE TYPE artifact_type AS ENUM (
    'SUMMARY',
    'FUNCTIONAL_REQUIREMENTS',
    'NON_FUNCTIONAL_REQUIREMENTS',
    'BUSINESS_RULES',
    'ACTORS',
    'APIS',
    'DATABASE_TABLES',
    'VALIDATION_RULES',
    'ACCEPTANCE_CRITERIA',
    'DEPENDENCIES',
    'RISKS',
    'OPEN_QUESTIONS',
    'DEVELOPMENT_TASKS',
    'STORY_POINTS'
);

-- ── Step 3: Alter artifacts table to use new enum ──────────────────────────
-- Cast existing rows using a USING expression that maps v1 values to v2.
-- Unmappable values (TEST_SCENARIOS, TECHNICAL_NOTES, USER_STORIES,
-- COMPLEXITY_SCORE, MISSING_INFO, NON_FUNCTIONAL_REQS) are NULL'd then
-- the rows are deleted — they hold stale data incompatible with v2 schema.
ALTER TABLE artifacts
    ALTER COLUMN artifact_type
    TYPE artifact_type
    USING (
        CASE artifact_type::text
            WHEN 'SUMMARY'              THEN 'SUMMARY'::artifact_type
            WHEN 'ACCEPTANCE_CRITERIA'  THEN 'ACCEPTANCE_CRITERIA'::artifact_type
            WHEN 'RISKS'                THEN 'RISKS'::artifact_type
            -- v1-only types that have no v2 equivalent — will be NULLed,
            -- then the NULL rows will be deleted below.
            ELSE NULL
        END
    );

-- ── Step 4: Delete artifact rows with NULL type (unmappable v1 artifacts) ──
-- These are stale v1 analysis results that cannot be meaningfully migrated.
DELETE FROM artifacts WHERE artifact_type IS NULL;

-- ── Step 5: Re-add NOT NULL constraint (was implicitly dropped by the USING NULL) ──
ALTER TABLE artifacts ALTER COLUMN artifact_type SET NOT NULL;

-- ── Step 6: Drop the old enum ───────────────────────────────────────────────
DROP TYPE artifact_type_v1;

-- ── Step 7: Bump prompt_version default to v2 on analyses table ────────────
ALTER TABLE analyses
    ALTER COLUMN prompt_version SET DEFAULT 'v2';

-- ── Step 8: Update seed / existing analyses to mark prompt_version ─────────
-- Mark any prior completed analyses as v1 explicitly for auditability.
UPDATE analyses
SET    prompt_version = 'v1'
WHERE  prompt_version = 'v1'   -- already correct, no-op but documents intent
   OR  prompt_version IS NULL;

-- ── Comments ────────────────────────────────────────────────────────────────
COMMENT ON TYPE artifact_type IS
    'v2 artifact types (14 values). Matches PromptBuilder v2 JSON output keys. '
    'Upgraded from 9-value v1 enum in migration 012.';

COMMIT;
