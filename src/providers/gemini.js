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

class GeminiProvider {
  constructor({ apiKey = process.env.GEMINI_API_KEY, baseUrl, model = 'gemini-2.0-flash', temperature = 0.2, maxTokens } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
  }

  async generateJson({ system, prompt }) {
    if (!this.apiKey) {
      throw new Error('[KLAW][PROVIDER] Missing GEMINI_API_KEY. Set GEMINI_API_KEY or configure apiKey in config.');
    }

    const contents = [
      { role: 'user', parts: [{ text: system }] },
      { role: 'user', parts: [{ text: prompt }] }
    ];

    const response = await fetch(`${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: this.temperature,
          maxOutputTokens: this.maxTokens,
          responseMimeType: 'application/json'
        }
      })
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Gemini request failed (${response.status}): ${body}`);
    }

    const payload = JSON.parse(body);
    return extractJson(payload.candidates?.[0]?.content?.parts?.[0]?.text || '');
  }
}

module.exports = { GeminiProvider };