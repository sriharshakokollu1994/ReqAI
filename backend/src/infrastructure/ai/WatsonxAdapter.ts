import axios from 'axios';
import { AIProvider, AICompletionRequest, AICompletionResponse } from './IAIProvider';
import { logger } from '../../shared/logger';
import { ServiceUnavailableError } from '../../domain/errors/AppError';

/**
 * IBM watsonx.ai adapter — uses the text generation REST API.
 *
 * Required env vars (not in main Zod schema to keep schema concise; read directly):
 *   WATSONX_API_KEY      IBM Cloud IAM API key
 *   WATSONX_PROJECT_ID   watsonx project ID
 *   WATSONX_URL          e.g. https://us-south.ml.cloud.ibm.com
 *   WATSONX_MODEL        e.g. meta-llama/llama-3-1-70b-instruct
 */
const WX_URL     = process.env.WATSONX_URL        ?? 'https://us-south.ml.cloud.ibm.com';
const WX_PROJECT = process.env.WATSONX_PROJECT_ID ?? '';
const WX_MODEL   = process.env.WATSONX_MODEL      ?? 'ibm/granite-13b-chat-v2';
const IAM_URL    = 'https://iam.cloud.ibm.com/identity/token';

interface IamTokenCache {
  token:     string;
  expiresAt: number;  // epoch ms
}

let iamCache: IamTokenCache | null = null;

async function getIAMToken(apiKey: string): Promise<string> {
  const now = Date.now();
  if (iamCache && iamCache.expiresAt > now + 60_000) return iamCache.token;

  const response = await axios.post(
    IAM_URL,
    new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey:     apiKey,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );

  iamCache = {
    token:     response.data.access_token,
    expiresAt: now + response.data.expires_in * 1_000,
  };
  return iamCache.token;
}

export class WatsonxAdapter implements AIProvider {
  readonly providerName = 'WATSONX';
  readonly modelName: string;

  private readonly apiKey: string;

  constructor() {
    const key = process.env.WATSONX_API_KEY;
    if (!key) throw new Error('WATSONX_API_KEY is required when AI_PROVIDER=WATSONX');
    if (!WX_PROJECT) throw new Error('WATSONX_PROJECT_ID is required when AI_PROVIDER=WATSONX');
    this.apiKey    = key;
    this.modelName = WX_MODEL;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const start = Date.now();
    try {
      const token = await getIAMToken(this.apiKey);

      // Combine system + user prompts into a single instruction block
      const prompt = `<|system|>\n${request.systemPrompt}\n<|user|>\n${request.userPrompt}\n<|assistant|>`;

      const { data } = await axios.post(
        `${WX_URL}/ml/v1/text/generation?version=2024-03-14`,
        {
          model_id:    this.modelName,
          project_id:  WX_PROJECT,
          input:       prompt,
          parameters: {
            max_new_tokens:  request.maxTokens  ?? 4_096,
            temperature:     request.temperature ?? 0.2,
            decoding_method: 'greedy',
            stop_sequences:  ['<|user|>'],
          },
        },
        {
          headers: {
            Authorization:  `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const result          = data.results?.[0];
      const text            = result?.generated_text ?? '';
      const tokensPrompt    = result?.input_token_count    ?? 0;
      const tokensCompletion = result?.generated_token_count ?? 0;
      const tokensTotal     = tokensPrompt + tokensCompletion;

      if (!text) throw new ServiceUnavailableError('watsonx returned an empty response');

      logger.debug('watsonx completion', {
        model:      this.modelName,
        durationMs: Date.now() - start,
        tokensTotal,
      });

      return { text, tokensPrompt, tokensCompletion, tokensTotal, costUsd: null, model: this.modelName };
    } catch (err: any) {
      if (err instanceof ServiceUnavailableError) throw err;
      logger.error('watsonx API error', { error: err.message });
      throw new ServiceUnavailableError(`watsonx request failed: ${err.message}`);
    }
  }
}
