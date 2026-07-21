/**
 * Unit tests — PromptBuilder v2
 *
 * Tests cover:
 *  - buildSystemPrompt: structure, 14 required JSON keys, 39 principles present
 *  - buildUserPrompt:   required sections, optional sections conditional inclusion
 *  - Output contract:   verifies the embedded JSON schema mentions all 14 artifact field names
 */

import { PromptBuilder } from '../../../infrastructure/ai/PromptBuilder';

// ── The 14 artifact keys the AI must return ──────────────────────────────────
const EXPECTED_ARTIFACT_KEYS = [
  'summary',
  'functionalRequirements',
  'nonFunctionalRequirements',
  'businessRules',
  'actors',
  'apis',
  'databaseTables',
  'validationRules',
  'acceptanceCriteria',
  'dependencies',
  'risks',
  'openQuestions',
  'developmentTasks',
  'storyPoints',
] as const;

describe('PromptBuilder', () => {
  let builder: PromptBuilder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  // ── buildSystemPrompt ──────────────────────────────────────────────────────

  describe('buildSystemPrompt()', () => {
    let systemPrompt: string;

    beforeEach(() => {
      systemPrompt = builder.buildSystemPrompt();
    });

    it('returns a non-empty string', () => {
      expect(typeof systemPrompt).toBe('string');
      expect(systemPrompt.length).toBeGreaterThan(100);
    });

    it('is deterministic — same output on multiple calls', () => {
      expect(builder.buildSystemPrompt()).toBe(systemPrompt);
    });

    it('declares the CRITICAL OUTPUT RULE', () => {
      expect(systemPrompt).toContain('CRITICAL OUTPUT RULE');
      expect(systemPrompt).toContain('SINGLE valid JSON object');
    });

    it.each(EXPECTED_ARTIFACT_KEYS)(
      'schema contains artifact key "%s"',
      (key) => {
        expect(systemPrompt).toContain(`"${key}"`);
      },
    );

    it('embeds all 14 artifact field names in the schema block', () => {
      const schema_block_start = systemPrompt.indexOf('REQUIRED JSON SCHEMA');
      expect(schema_block_start).toBeGreaterThan(-1);
      EXPECTED_ARTIFACT_KEYS.forEach((key) => {
        expect(systemPrompt.indexOf(`"${key}"`, schema_block_start)).toBeGreaterThan(-1);
      });
    });

    it('contains exactly the analysis principles section header', () => {
      expect(systemPrompt).toContain('ANALYSIS PRINCIPLES');
    });

    it('contains principle 39 (last principle)', () => {
      // Principle 39 is the last one in the ANALYSIS PRINCIPLES block
      expect(systemPrompt).toContain('39.');
    });

    it('references risk score formula (Probability × Impact)', () => {
      expect(systemPrompt).toContain('Risk Score');
      expect(systemPrompt).toContain('HIGH=3');
      expect(systemPrompt).toContain('MEDIUM=2');
      expect(systemPrompt).toContain('LOW=1');
    });

    it('references the modified Fibonacci scale', () => {
      expect(systemPrompt).toContain('1, 2, 3, 5, 8, 13, 20');
    });

    it('specifies MoSCoW priority values', () => {
      expect(systemPrompt).toContain('MUST_HAVE');
      expect(systemPrompt).toContain('SHOULD_HAVE');
      expect(systemPrompt).toContain('COULD_HAVE');
      expect(systemPrompt).toContain('WONT_HAVE');
    });
  });

  // ── buildUserPrompt ────────────────────────────────────────────────────────

  describe('buildUserPrompt()', () => {
    const baseInput = {
      requirementTitle: 'User Authentication System',
      requirementBody:  'Users must be able to register, log in, and reset passwords securely.',
    };

    it('includes the requirement title in the output', () => {
      const prompt = builder.buildUserPrompt(baseInput);
      expect(prompt).toContain('User Authentication System');
    });

    it('includes the requirement body in the output', () => {
      const prompt = builder.buildUserPrompt(baseInput);
      expect(prompt).toContain('Users must be able to register');
    });

    it('contains the ANALYSIS INSTRUCTIONS section', () => {
      const prompt = builder.buildUserPrompt(baseInput);
      expect(prompt).toContain('ANALYSIS INSTRUCTIONS');
    });

    it('references all 39 analysis principles in the instructions', () => {
      const prompt = builder.buildUserPrompt(baseInput);
      expect(prompt).toContain('39 Analysis Principles');
    });

    it('does NOT include ANALYST CONTEXT section when context is omitted', () => {
      const prompt = builder.buildUserPrompt(baseInput);
      expect(prompt).not.toContain('ANALYST CONTEXT');
    });

    it('includes ANALYST CONTEXT section when context is provided', () => {
      const prompt = builder.buildUserPrompt({
        ...baseInput,
        analystContext: 'This is a B2B SaaS product targeting enterprise customers',
      });
      expect(prompt).toContain('ANALYST CONTEXT');
      expect(prompt).toContain('B2B SaaS product');
    });

    it('does NOT include TECHNOLOGY STACK section when techStack is omitted', () => {
      const prompt = builder.buildUserPrompt(baseInput);
      expect(prompt).not.toContain('TECHNOLOGY STACK');
    });

    it('includes TECHNOLOGY STACK section when techStack is provided', () => {
      const prompt = builder.buildUserPrompt({
        ...baseInput,
        techStack: 'Node.js, PostgreSQL, React 19',
      });
      expect(prompt).toContain('TECHNOLOGY STACK');
      expect(prompt).toContain('Node.js, PostgreSQL, React 19');
    });

    it('does NOT include BUSINESS DOMAIN section when domain is omitted', () => {
      const prompt = builder.buildUserPrompt(baseInput);
      expect(prompt).not.toContain('BUSINESS DOMAIN');
    });

    it('includes BUSINESS DOMAIN section when domain is provided', () => {
      const prompt = builder.buildUserPrompt({
        ...baseInput,
        domain: 'fintech',
      });
      expect(prompt).toContain('BUSINESS DOMAIN');
      expect(prompt).toContain('fintech');
    });

    it('includes all four optional sections when all are provided', () => {
      const prompt = builder.buildUserPrompt({
        ...baseInput,
        analystContext: 'Some context',
        techStack:      'Python, FastAPI',
        domain:         'healthcare',
      });
      expect(prompt).toContain('ANALYST CONTEXT');
      expect(prompt).toContain('TECHNOLOGY STACK');
      expect(prompt).toContain('BUSINESS DOMAIN');
    });

    it('instructs the model to return a SINGLE valid JSON object', () => {
      const prompt = builder.buildUserPrompt(baseInput);
      expect(prompt).toContain('SINGLE valid JSON object');
    });

    it('documents the ID padding format (3 digits)', () => {
      const prompt = builder.buildUserPrompt(baseInput);
      // e.g. "FR-001"
      expect(prompt).toMatch(/FR-\d{3}/);
    });

    it('states the risk score formula in the output requirements', () => {
      const prompt = builder.buildUserPrompt(baseInput);
      expect(prompt).toContain('Probability × Impact');
    });

    it('states the story point total equality constraint', () => {
      const prompt = builder.buildUserPrompt(baseInput);
      expect(prompt).toContain('Story point total must equal the sum');
    });

    it('produces a string longer than 200 characters', () => {
      const prompt = builder.buildUserPrompt(baseInput);
      expect(prompt.length).toBeGreaterThan(200);
    });
  });
});
