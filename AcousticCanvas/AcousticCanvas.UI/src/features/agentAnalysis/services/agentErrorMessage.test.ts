import { describe, it, expect } from 'vitest';
import { toFriendlyAgentError } from './agentErrorMessage';

describe('toFriendlyAgentError', () => {
  it('maps a missing OpenAI API key (401) to configuration guidance', () => {
    const rawBody =
      'Agent orchestration error: OpenAI API returned 401: { "error": ' +
      '{ "message": "You didn\'t provide an API key.", ' +
      '"type": "invalid_request_error" } }';

    const message = toFriendlyAgentError(500, rawBody);

    expect(message).toContain('isn\u2019t configured');
    expect(message).toContain('OpenAI:ApiKey');
    expect(message).not.toContain('401');
    expect(message).not.toContain('invalid_request_error');
  });

  it('maps a backend "is not configured" error to configuration guidance', () => {
    const rawBody = 'OpenAI:ApiKey is not configured. Set it in appsettings.json.';

    const message = toFriendlyAgentError(500, rawBody);

    expect(message).toContain('isn\u2019t configured');
  });

  it('maps a 429 to a rate-limit message', () => {
    const message = toFriendlyAgentError(429, 'Too Many Requests');

    expect(message).toContain('rate-limited');
  });

  it('maps a generic 500 to a server-error message', () => {
    const message = toFriendlyAgentError(500, 'Internal Server Error');

    expect(message).toContain('server error');
  });

  it('falls back to a generic message for other failures', () => {
    const message = toFriendlyAgentError(400, 'Bad Request');

    expect(message).toContain('couldn\u2019t complete');
    expect(message).not.toContain('400');
  });
});
