import { AIProvider } from './IAIProvider';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { AzureOpenAIAdapter } from './AzureOpenAIAdapter';
import { WatsonxAdapter } from './WatsonxAdapter';
import { env } from '../../config/env';

/**
 * Factory that reads AI_PROVIDER from the validated env and returns
 * the matching adapter.  Add new providers here without touching callers.
 */
export class AIProviderFactory {
  private static instance: AIProvider | null = null;

  static getProvider(): AIProvider {
    if (AIProviderFactory.instance) return AIProviderFactory.instance;

    switch (env.AI_PROVIDER) {
      case 'OPENAI':
        AIProviderFactory.instance = new OpenAIAdapter();
        break;
      case 'ANTHROPIC':
        AIProviderFactory.instance = new AnthropicAdapter();
        break;
      case 'AZURE_OPENAI':
        AIProviderFactory.instance = new AzureOpenAIAdapter();
        break;
      case 'WATSONX':
        AIProviderFactory.instance = new WatsonxAdapter();
        break;
      case 'CUSTOM':
        // Fall-through: default to OpenAI-compatible endpoint.
        AIProviderFactory.instance = new OpenAIAdapter();
        break;
      default:
        throw new Error(`Unsupported AI_PROVIDER: ${env.AI_PROVIDER}`);
    }

    return AIProviderFactory.instance;
  }

  /** Reset cached instance (useful for testing). */
  static reset(): void {
    AIProviderFactory.instance = null;
  }
}
