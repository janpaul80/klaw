/**
 * Anthropic Provider
 * Implements BaseProvider interface for Anthropic API
 */

const { BaseProvider } = require('./base');
const { KlawError } = require('../errors/klaw-error');
const { extractJson } = require('./utils');

class AnthropicProvider extends BaseProvider {
  constructor(cfg = {}) {
    const apiKey = cfg.apiKey || process.env.ANTHROPIC_API_KEY;
    super({
      apiKey,
      model: cfg.model || 'claude-3-5-sonnet-20241022',
      name: 'anthropic',
      baseUrl: cfg.baseUrl || 'https://api.anthropic.com/v1'
    });
    this.temperature = cfg.temperature || 0.2;
    this.maxTokens = cfg.maxTokens || 4096;
  }

  validateConfig() {
    const errors = [];
    if (!this.apiKey) {
      errors.push('Missing ANTHROPIC_API_KEY');
    }
    return { valid: errors.length === 0, errors };
  }

  async healthCheck() {
    const { valid, errors } = this.validateConfig();
    if (!valid) {
      return { ok: false, message: errors.join(', ') };
    }

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-beta': 'max-tokens-3-5-2024-07-15',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }]
        })
      });

      const body = await response.text();

      if (!response.ok) {
        return { ok: false, message: `HTTP ${response.status}: ${body}` };
      }

      return { ok: true, message: 'OK' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  async complete(prompt, opts = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-beta': 'max-tokens-3-5-2024-07-15',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: opts.model || this.model,
          temperature: opts.temperature || this.temperature,
          max_tokens: opts.maxTokens || this.maxTokens,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const body = await response.text();

      if (!response.ok) {
        throw new KlawError({
          code: 'PROVIDER_ERROR',
          provider: 'anthropic',
          stage: 'complete',
          message: `HTTP ${response.status}: ${body}`
        });
      }

      const payload = JSON.parse(body);
      const content = payload.content?.[0]?.text;
      if (!content) {
        throw new KlawError({
          code: 'EMPTY_RESPONSE',
          provider: 'anthropic',
          stage: 'complete',
          message: 'Provider returned empty response'
        });
      }

      return content.trim();
    } catch (err) {
      if (err instanceof KlawError) throw err;
      throw new KlawError({
        code: 'PROVIDER_ERROR',
        provider: 'anthropic',
        stage: 'complete',
        message: err.message
      });
    }
  }

  async generateJson({ system, prompt }) {
    // Legacy method for backward compatibility
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
    const result = await this.complete(fullPrompt);

    // Use shared parser
    return extractJson(result);
  }
}

module.exports = { AnthropicProvider };