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

class OllamaProvider {
  constructor({ baseUrl = 'http://localhost:11434', model = 'llama3.2', temperature = 0.2, maxTokens } = {}) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
  }

  async generateJson({ system, prompt }) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        stream: false
      })
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Ollama request failed (${response.status}): ${body}`);
    }

    const payload = JSON.parse(body);
    return extractJson(payload.message?.content || '');
  }
}

module.exports = { OllamaProvider };