/**
 * Gemini Provider
 * Implements BaseProvider interface for Google Gemini API
 */

const { BaseProvider } = require('./base');
const { KlawError } = require('../errors/klaw-error');
const { extractJson } = require('./utils');

class GeminiProvider extends BaseProvider {
  constructor(cfg = {}) {
    const apiKey = cfg.apiKey || process.env.GEMINI_API_KEY;
    super({
      apiKey,
      model: cfg.model || 'gemini-2.0-flash',
      name: 'gemini',
      baseUrl: cfg.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
    });
    this.temperature = cfg.temperature || 0.2;
    this.maxTokens = cfg.maxTokens || 4000;
  }

  validateConfig() {
    const errors = [];
    if (!this.apiKey) errors.push('Missing GEMINI_API_KEY');
    return { valid: errors.length === 0, errors };
  }

  async healthCheck() {
    const { valid, errors } = this.validateConfig();
    if (!valid) return { ok: false, message: errors.join(', ') };

    try {
      const res = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);
      return { ok: res.ok, message: res.ok ? 'OK' : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  async complete(prompt, opts = {}) {
    try {
      const contents = [
        { role: 'user', parts: [{ text: prompt }] }
      ];
      const response = await fetch(`${this.baseUrl}/models/${opts.model || this.model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: opts.temperature || this.temperature,
            maxOutputTokens: opts.maxTokens || this.maxTokens,
            responseMimeType: 'application/json'
          }
        })
      });

      const body = await response.text();
      if (!response.ok) {
        throw new KlawError({
          code: 'PROVIDER_ERROR',
          provider: 'gemini',
          stage: 'complete',
          message: `HTTP ${response.status}: ${body}`
        });
      }

      const payload = JSON.parse(body);
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new KlawError({
          code: 'EMPTY_RESPONSE',
          provider: 'gemini',
          stage: 'complete',
          message: 'Provider returned empty response'
        });
      }
      return text.trim();
    } catch (err) {
      if (err instanceof KlawError) throw err;
      throw new KlawError({
        code: 'PROVIDER_ERROR',
        provider: 'gemini',
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

module.exports = { GeminiProvider };