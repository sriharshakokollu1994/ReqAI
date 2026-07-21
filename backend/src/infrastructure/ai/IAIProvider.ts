/**
 * Contract every AI provider adapter must satisfy.
 */
export interface AICompletionRequest {
  systemPrompt: string;
  userPrompt:   string;
  /** Max tokens to generate */
  maxTokens?:   number;
  /** Sampling temperature (0 = deterministic) */
  temperature?: number;
}

export interface AICompletionResponse {
  /** Raw text returned by the model */
  text:            string;
  tokensPrompt:    number;
  tokensCompletion: number;
  tokensTotal:     number;
  /** Estimated cost in USD; null when unknown */
  costUsd:         number | null;
  /** Actual model identifier echoed back */
  model:           string;
}

export interface AIProvider {
  /**
   * Send a completion request and return a structured response.
   * Throw an AppError (or subclass) on API/network failure.
   */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;

  /** Human-readable provider identifier, used in logs and DB records. */
  readonly providerName: string;
  /** Active model identifier */
  readonly modelName: string;
}
