/**
 * Provider Factory
 * Creates and validates provider instances
 */
const { OpenAIProvider } = require('./openai');
const { OpenRouterProvider } = require('./openrouter');
const { AnthropicProvider } = require('./anthropic');
const { OllamaProvider } = require('./ollama');
const { GeminiProvider } = require('./gemini');
const { LangdockProvider } = require('./langdock');
const { KlawError } = require('../errors/klaw-error');

const providers = {
  openai: OpenAIProvider,
  openrouter: OpenRouterProvider,
  anthropic: AnthropicProvider,
  ollama: OllamaProvider,
  gemini: GeminiProvider,
  langdock: LangdockProvider
};

function createProvider(config) {
  const name = config.provider || 'openai';
  const Provider = providers[name];

  if (!Provider) {
    throw new KlawError({
      code: 'PROVIDER_CONFIG_ERROR',
      provider: name,
      stage: 'factory',
      message: `Unknown provider: ${name}. Available: ${Object.keys(providers).join(', ')}`
    });
  }

  const instance = new Provider(config);
  const validation = instance.validateConfig();

  if (!validation.valid) {
    throw new KlawError({
      code: 'PROVIDER_CONFIG_ERROR',
      provider: name,
      stage: 'factory',
      message: `Invalid configuration: ${validation.errors.join(', ')}`
    });
  }

  return instance;
}

module.exports = { createProvider, providers };