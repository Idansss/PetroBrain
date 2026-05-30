/**
 * FastAPI surfaces validation/business errors as ``{ detail: ... }``.
 * ``ApiError`` carries the status + the parsed detail so callers can
 * decide whether to retry, surface the message to the user, or escalate.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown) {
    super(`PetroBrain API error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }

  detailString(): string {
    if (this.detail == null) return '';
    if (typeof this.detail === 'string') return this.detail;
    if (typeof this.detail === 'object' && 'detail' in (this.detail as object)) {
      const inner = (this.detail as { detail: unknown }).detail;
      return typeof inner === 'string' ? inner : JSON.stringify(inner);
    }
    return JSON.stringify(this.detail);
  }
}
