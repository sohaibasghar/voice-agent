import { HttpException, HttpStatus } from '@nestjs/common';
import type { ToolErrorCode } from '@voice-agent/shared';

/**
 * Domain error raised by tool providers when an authoritative guardrail or
 * validation rejects an operation (Constitution III). Carries a stable error
 * `code` from the shared contract so the agent can react (e.g. re-offer slots,
 * ask for confirmation). Maps to HTTP 409 Conflict by default.
 */
export class ToolError extends HttpException {
  constructor(
    readonly code: ToolErrorCode,
    message?: string,
    status: HttpStatus = HttpStatus.CONFLICT,
  ) {
    super({ code, message: message ?? code }, status);
  }
}
