import OpenAI from 'openai';
import { AIProvider, AICompletionRequest, AICompletionResponse } from './IAIProvider';
import { env } from '../../config/env';
import { logger, logAIRequest, logAIResponse } from '../../shared/logger';
import { ServiceUnavailableError } from '../../domain/errors/AppError';

/** Per-model cost table (USD per 1 000 tokens). Extend as models are added. */
const COST_TABLE: Record<string, { input: number; output: number }> = {
  'gpt-4o':               { input: 0.005,   output: 0.015   },
  'gpt-4o-mini':          { input: 0.00015, output: 0.0006  },
  'gpt-4-turbo':          { input: 0.01,    output: 0.03    },
  'gpt-3.5-turbo':        { input: 0.0005,  output: 0.0015  },
  'gpt-3.5-turbo-16k':    { input: 0.001,   output: 0.002   },
};

function estimateCost(model: string, prompt: number, completion: number): number | null {
  const rates = COST_TABLE[model];
  if (!rates) return null;
  return (prompt / 1_000) * rates.input + (completion / 1_000) * rates.output;
}

export class OpenAIAdapter implements AIProvider {
  readonly providerName = 'OPENAI';
  readonly modelName: string;

  private readonly client: OpenAI;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=OPENAI');
    }
    this.client    = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.modelName = env.OPENAI_MODEL;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const start = process.hrtime.bigint();

    // ── Log outbound request ───────────────────────────────────────────────
    logAIRequest({
      provider:        this.providerName,
      model:           this.modelName,
      systemPromptLen: request.systemPrompt.length,
      userPromptLen:   request.userPrompt.length,
      temperature:     request.temperature ?? 0.2,
    });

    try {
      const completion = await this.client.chat.completions.create({
        model:       this.modelName,
        temperature: request.temperature ?? 0.2,
        max_tokens:  request.maxTokens   ?? 4_096,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user',   content: request.userPrompt   },
        ],
        response_format: { type: 'json_object' },
      });

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        throw new ServiceUnavailableError('OpenAI returned an empty response');
      }

      const usage            = completion.usage;
      const tokensPrompt     = usage?.prompt_tokens    ?? 0;
      const tokensCompletion = usage?.completion_tokens ?? 0;
      const tokensTotal      = usage?.total_tokens      ?? 0;
      const durationMs       = Number(process.hrtime.bigint() - start) / 1_000_000;
      const costUsd          = estimateCost(this.modelName, tokensPrompt, tokensCompletion);

      // ── Log successful response ──────────────────────────────────────────
      logAIResponse({
        provider:         this.providerName,
        model:            completion.model,
        durationMs:       Math.round(durationMs),
        tokensPrompt,
        tokensCompletion,
        tokensTotal,
        costUsd,
        success:          true,
      });

      return {
        text:             choice.message.content,
        tokensPrompt,
        tokensCompletion,
        tokensTotal,
        costUsd,
        model:            completion.model,
      };
    } catch (err: any) {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

      if (err instanceof ServiceUnavailableError) {
        logAIResponse({
          provider: this.providerName, model: this.modelName,
          durationMs: Math.round(durationMs),
          tokensPrompt: 0, tokensCompletion: 0, tokensTotal: 0, costUsd: null,
          success: false, errorMessage: err.message,
        });
        throw err;
      }

      // ── Log failed response ──────────────────────────────────────────────
      logAIResponse({
        provider:     this.providerName,
        model:        this.modelName,
        durationMs:   Math.round(durationMs),
        tokensPrompt: 0, tokensCompletion: 0, tokensTotal: 0, costUsd: null,
        success:      false,
        errorMessage: err.message,
      });

      logger.error('OpenAI API error', {
        category:  'ai',
        provider:  this.providerName,
        errorCode: err.code,
        message:   err.message,
      });
      throw new ServiceUnavailableError(`OpenAI request failed: ${err.message}`);
    }
  }
}
