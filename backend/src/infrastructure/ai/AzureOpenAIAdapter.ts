import OpenAI from 'openai';
import { AIProvider, AICompletionRequest, AICompletionResponse } from './IAIProvider';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';
import { ServiceUnavailableError } from '../../domain/errors/AppError';

/**
 * Azure OpenAI uses the same SDK as OpenAI but targets a custom endpoint.
 * The deployment name acts as the model identifier.
 */
export class AzureOpenAIAdapter implements AIProvider {
  readonly providerName = 'AZURE_OPENAI';
  readonly modelName: string;

  private readonly client: OpenAI;

  constructor() {
    if (!env.AZURE_OPENAI_API_KEY || !env.AZURE_OPENAI_ENDPOINT) {
      throw new Error(
        'AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT are required when AI_PROVIDER=AZURE_OPENAI',
      );
    }

    this.modelName = env.OPENAI_MODEL; // Azure deployment name

    this.client = new OpenAI({
      apiKey:   env.AZURE_OPENAI_API_KEY,
      baseURL:  `${env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${this.modelName}`,
      defaultQuery:   { 'api-version': '2024-02-01' },
      defaultHeaders: { 'api-key': env.AZURE_OPENAI_API_KEY },
    });
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const start = Date.now();
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
        throw new ServiceUnavailableError('Azure OpenAI returned an empty response');
      }

      const usage = completion.usage;
      const tokensPrompt     = usage?.prompt_tokens    ?? 0;
      const tokensCompletion = usage?.completion_tokens ?? 0;
      const tokensTotal      = usage?.total_tokens      ?? 0;

      logger.debug('Azure OpenAI completion', {
        model:      this.modelName,
        durationMs: Date.now() - start,
        tokensTotal,
      });

      return {
        text:             choice.message.content,
        tokensPrompt,
        tokensCompletion,
        tokensTotal,
        costUsd:          null, // Azure pricing is bespoke per deployment
        model:            this.modelName,
      };
    } catch (err: any) {
      if (err instanceof ServiceUnavailableError) throw err;
      logger.error('Azure OpenAI API error', { error: err.message });
      throw new ServiceUnavailableError(`Azure OpenAI request failed: ${err.message}`);
    }
  }
}
