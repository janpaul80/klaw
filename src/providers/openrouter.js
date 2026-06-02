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

class OpenRouterProvider {
  constructor({ apiKey = process.env.OPENROUTER_API_KEY, baseUrl, model = 'openai/gpt-4.1-mini', temperature = 0.2, maxTokens } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://openrouter.ai/api/v1';
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
  }

  async generateJson({ system, prompt }) {
    if (!this.apiKey) {
      throw new Error('[KLAW][PROVIDER] Missing OPENROUTER_API_KEY. Set OPENROUTER_API_KEY or configure apiKey in config.');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://klaw.at',
        'X-Title': 'KLAW'
      },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ]
      })
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`OpenRouter request failed (${response.status}): ${body}`);
    }

    const payload = JSON.parse(body);
    return extractJson(payload.choices?.[0]?.message?.content);
  }
}

module.exports = { OpenRouterProvider };