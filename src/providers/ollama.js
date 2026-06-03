/**
 * Ollama Provider
 * Implements BaseProvider interface for Ollama local API
 */

const { BaseProvider } = require('./base');
const { KlawError } = require('../errors/klaw-error');
const { extractJson } = require('./utils');

class OllamaProvider extends BaseProvider {
  constructor(cfg = {}) {
    super({
      apiKey: null, // Ollama doesn't use API keys
      model: cfg.model || 'llama3.2',
      name: 'ollama',
      baseUrl: cfg.baseUrl || 'http://localhost:11434'
    });
    this.temperature = cfg.temperature || 0.2;
    this.maxTokens = cfg.maxTokens;
  }

  validateConfig() {
    // Ollama has no required API key - config always valid if baseUrl is present
    const errors = [];
    if (!this.baseUrl) errors.push('Missing baseUrl for Ollama');
    return { valid: errors.length === 0, errors };
  }

  async healthCheck() {
    const { valid, errors } = this.validateConfig();
    if (!valid) return { ok: false, message: errors.join(', ') };

    try {
      // Check server is reachable
      const tagsRes = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
      if (!tagsRes.ok) {
        return { ok: false, message: `Server unreachable: HTTP ${tagsRes.status}` };
      }

      // Check configured model is available
      const tagsBody = await tagsRes.json();
      const models = tagsBody.models || [];
      const modelNames = models.map(m => m.name);
      const hasModel = modelNames.some(name => name.startsWith(this.model));

      if (!hasModel) {
        return { ok: false, message: `Model "${this.model}" not available. Available: ${modelNames.slice(0, 5).join(', ')}` };
      }

      return { ok: true, message: 'OK' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  async complete(prompt, opts = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: opts.model || this.model,
          temperature: opts.temperature || this.temperature,
          max_tokens: opts.maxTokens || this.maxTokens,
          messages: [{ role: 'user', content: prompt }],
          stream: false
        })
      });

      const body = await response.text();
      if (!response.ok) {
        throw new KlawError({
          code: 'PROVIDER_ERROR',
          provider: 'ollama',
          stage: 'complete',
          message: `HTTP ${response.status}: ${body}`
        });
      }

      const payload = JSON.parse(body);
      const content = payload.message?.content;
      if (!content) {
        throw new KlawError({
          code: 'EMPTY_RESPONSE',
          provider: 'ollama',
          stage: 'complete',
          message: 'Provider returned empty response'
        });
      }
      return content.trim();
    } catch (err) {
      if (err instanceof KlawError) throw err;
      throw new KlawError({
        code: 'PROVIDER_ERROR',
        provider: 'ollama',
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

module.exports = { OllamaProvider };