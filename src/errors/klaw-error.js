/**
 * KLAW Unified Error Structure
 * Provides consistent error metadata across all providers
 */
class KlawError extends Error {
  constructor({ code, provider, stage, message }) {
    super(message);
    this.name = 'KlawError';
    this.code = code;
    this.provider = provider;
    this.stage = stage;
  }

  toJSON() {
    return {
      code: this.code,
      provider: this.provider,
      stage: this.stage,
      message: this.message
    };
  }
}

module.exports = { KlawError };