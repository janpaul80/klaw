/**
 * OpenRouter Provider
 * Implements BaseProvider interface for OpenRouter API
 */

const { BaseProvider } = require('./base');
const { KlawError } = require('../errors/klaw-error');

class OpenRouterProvider extends BaseProvider {
  constructor(cfg = {}) {
    const apiKey = cfg.apiKey || process.env.OPENROUTER_API_KEY;
    super({
      apiKey,
      model: cfg.model || 'openai/gpt-4o-mini',
      name: 'openrouter',
      baseUrl: cfg.baseUrl || 'https://openrouter.ai/api/v1'
    });
    this.temperature = cfg.temperature || 0.2;
    this.maxTokens = cfg.maxTokens;
  }

  validateConfig() {
    const errors = [];
    if (!this.apiKey) {
      errors.push('Missing OPENROUTER_API_KEY');
    }
    return { valid: errors.length === 0, errors };
  }

  async healthCheck() {
    const { valid, errors } = this.validateConfig();
    if (!valid) {
      return { ok: false, message: errors.join(', ') };
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://klaw.at',
          'X-Title': 'KLAW'
        }
      });

      if (!response.ok) {
        return { ok: false, message: `HTTP ${response.status}` };
      }

      return { ok: true, message: 'OK' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  async complete(prompt, opts = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://klaw.at',
          'X-Title': 'KLAW'
        },
        body: JSON.stringify({
          model: opts.model || this.model,
          temperature: opts.temperature || this.temperature,
          max_tokens: opts.maxTokens || this.maxTokens,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      const body = await response.text();

      if (!response.ok) {
        throw new KlawError({
          code: 'PROVIDER_ERROR',
          provider: 'openrouter',
          stage: 'complete',
          message: `HTTP ${response.status}: ${body}`
        });
      }

      const payload = JSON.parse(body);
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new KlawError({
          code: 'EMPTY_RESPONSE',
          provider: 'openrouter',
          stage: 'complete',
          message: 'Provider returned empty response'
        });
      }

      return content.trim();
    } catch (err) {
      if (err instanceof KlawError) throw err;
      throw new KlawError({
        code: 'PROVIDER_ERROR',
        provider: 'openrouter',
        stage: 'complete',
        message: err.message
      });
    }
  }

  async generateJson({ system, prompt }) {
    // Legacy method for backward compatibility
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
    const result = await this.complete(fullPrompt);

    const trimmed = String(result || '').trim();
    if (!trimmed) {
      throw new KlawError({
        code: 'EMPTY_RESPONSE',
        provider: 'openrouter',
        stage: 'generateJson',
        message: 'Provider returned an empty response'
      });
    }

    try {
      return JSON.parse(trimmed);
    } catch (_) {
      const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced) return JSON.parse(fenced[1]);
      const firstObject = trimmed.indexOf('{');
      const firstArray = trimmed.indexOf('[');
      const start = [firstObject, firstArray].filter((index) => index >= 0).sort((a, b) => a - b)[0];
      if (start === undefined) {
        throw new KlawError({
          code: 'INVALID_JSON',
          provider: 'openrouter',
          stage: 'generateJson',
          message: 'Provider response did not contain JSON'
        });
      }
      const end = trimmed[start] === '[' ? trimmed.lastIndexOf(']') : trimmed.lastIndexOf('}');
      return JSON.parse(trimmed.slice(start, end + 1));
    }
  }
}

module.exports = { OpenRouterProvider };