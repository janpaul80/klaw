function extractJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Provider returned an empty response');
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1]);
    const firstObject = trimmed.indexOf('{');
    const firstArray = trimmed.indexOf('[');
    const start = [firstObject, firstArray].filter((index) => index >= 0).sort((a, b) => a - b)[0];
    if (start === undefined) throw new Error('Provider response did not contain JSON');
    const end = trimmed[start] === '[' ? trimmed.lastIndexOf(']') : trimmed.lastIndexOf('}');
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

class AnthropicProvider {
  constructor({ apiKey = process.env.ANTHROPIC_API_KEY, baseUrl, model = 'claude-3-5-haiku-20241022', temperature = 0.2, maxTokens } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://api.anthropic.com/v1';
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens || 4096;
  }

  async generateJson({ system, prompt }) {
    if (!this.apiKey) {
      throw new Error('[KLAW][PROVIDER] Missing ANTHROPIC_API_KEY. Set ANTHROPIC_API_KEY or configure apiKey in config.');
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-beta': 'max-tokens-3-5-2024-07-15',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Anthropic request failed (${response.status}): ${body}`);
    }

    const payload = JSON.parse(body);
    return extractJson(payload.content?.[0]?.text || '');
  }
}

module.exports = { AnthropicProvider };