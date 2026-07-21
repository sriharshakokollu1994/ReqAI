import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AICompletionRequest, AICompletionResponse } from './IAIProvider';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';
import { ServiceUnavailableError } from '../../domain/errors/AppError';

const COST_TABLE: Record<string, { input: number; output: number }> = {
  'claude-3-5-sonnet-20241022': { input: 0.003,  output: 0.015  },
  'claude-3-5-haiku-20241022':  { input: 0.001,  output: 0.005  },
  'claude-3-opus-20240229':     { input: 0.015,  output: 0.075  },
  'claude-3-sonnet-20240229':   { input: 0.003,  output: 0.015  },
  'claude-3-haiku-20240307':    { input: 0.00025, output: 0.00125 },
};

function estimateCost(model: string, prompt: number, completion: number): number | null {
  const rates = COST_TABLE[model];
  if (!rates) return null;
  return (prompt / 1_000) * rates.input + (completion / 1_000) * rates.output;
}

export class AnthropicAdapter implements AIProvider {
  readonly providerName = 'ANTHROPIC';
  readonly modelName: string;

  private readonly client: Anthropic;

  constructor() {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=ANTHROPIC');
    }
    this.client    = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    this.modelName = 'claude-3-5-sonnet-20241022';
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const start = Date.now();
    try {
      const message = await this.client.messages.create({
        model:      this.modelName,
        max_tokens: request.maxTokens ?? 4_096,
        system:     request.systemPrompt,
        messages: [
          {
            role:    'user',
            content: `${request.userPrompt}\n\nRespond with a valid JSON object only.`,
          },
        ],
      });

      const block = message.content.find((b) => b.type === 'text');
      if (!block || block.type !== 'text') {
        throw new ServiceUnavailableError('Anthropic returned an empty response');
      }

      const tokensPrompt     = message.usage.input_tokens;
      const tokensCompletion = message.usage.output_tokens;
      const tokensTotal      = tokensPrompt + tokensCompletion;

      logger.debug('Anthropic completion', {
        model:      this.modelName,
        durationMs: Date.now() - start,
        tokensTotal,
      });

      return {
        text:             block.text,
        tokensPrompt,
        tokensCompletion,
        tokensTotal,
        costUsd:          estimateCost(this.modelName, tokensPrompt, tokensCompletion),
        model:            this.modelName,
      };
    } catch (err: any) {
      if (err instanceof ServiceUnavailableError) throw err;
      logger.error('Anthropic API error', { error: err.message });
      throw new ServiceUnavailableError(`Anthropic request failed: ${err.message}`);
    }
  }
}
