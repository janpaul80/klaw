/**
 * Langdock Provider
 * Implements BaseProvider interface for Langdock API
 */

const { BaseProvider } = require('./base');
const { KlawError } = require('../errors/klaw-error');
const { extractJson } = require('./utils');

class LangdockProvider extends BaseProvider {
  constructor(cfg = {}) {
    const apiKey = cfg.apiKey || process.env.LANGDOCK_API_KEY;
    super({
      apiKey,
      model: cfg.model || 'gpt-4.1-mini',
      name: 'langdock',
      baseUrl: cfg.baseUrl || 'https://api.langdock.com/v1'
    });
    this.temperature = cfg.temperature || 0.2;
    this.maxTokens = cfg.maxTokens;
  }

  validateConfig() {
    const errors = [];
    if (!this.apiKey) errors.push('Missing LANGDOCK_API_KEY');
    return { valid: errors.length === 0, errors };
  }

  async healthCheck() {
    const { valid, errors } = this.validateConfig();
    if (!valid) return { ok: false, message: errors.join(', ') };

    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      return { ok: res.ok, message: res.ok ? 'OK' : `HTTP ${res.status}` };
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
          provider: 'langdock',
          stage: 'complete',
          message: `HTTP ${response.status}: ${body}`
        });
      }

      const payload = JSON.parse(body);
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new KlawError({
          code: 'EMPTY_RESPONSE',
          provider: 'langdock',
          stage: 'complete',
          message: 'Provider returned empty response'
        });
      }
      return content.trim();
    } catch (err) {
      if (err instanceof KlawError) throw err;
      throw new KlawError({
        code: 'PROVIDER_ERROR',
        provider: 'langdock',
        stage: 'complete',
        message: err.message
      });
    }
  }

  async generateJson({ system, prompt }) {
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
    const result = await this.complete(fullPrompt);
    return extractJson(result);
  }
}

module.exports = { LangdockProvider };