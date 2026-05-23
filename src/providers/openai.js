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

class OpenAIProvider {
  constructor({ apiKey = process.env.OPENAI_API_KEY, model = 'gpt-4.1-mini' } = {}) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateJson({ system, prompt }) {
    if (!this.apiKey) {
      throw new Error('[KLAW][PROVIDER] Missing OPENAI_API_KEY. Set OPENAI_API_KEY before running provider-backed tasks.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ]
      })
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`OpenAI request failed (${response.status}): ${body}`);
    }

    const payload = JSON.parse(body);
    return extractJson(payload.choices?.[0]?.message?.content);
  }
}

module.exports = { OpenAIProvider, extractJson };
