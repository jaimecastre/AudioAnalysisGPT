// Turns a raw backend/OpenAI failure into a short, friendly, actionable message
// for the chat UI. We never want to surface raw HTTP status codes or provider
// JSON to the user.

const MISSING_KEY_MESSAGE =
  'The AI agent isn\u2019t configured yet. Add an OpenAI API key on the backend ' +
  '(set "OpenAI:ApiKey" in appsettings.json or the OPENAI_API_KEY backend ' +
  'environment variable), then restart the backend and try again.';

const INVALID_KEY_MESSAGE =
  'The configured OpenAI API key was rejected. Rotate or replace the backend ' +
  'key, then restart the backend and try again.';

const RATE_LIMITED_MESSAGE =
  'The AI agent is rate-limited right now. Wait a few seconds and try again.';

const SERVER_ERROR_MESSAGE =
  'The AI agent hit a server error. Check the backend logs and try again.';

const GENERIC_MESSAGE =
  'The AI agent couldn\u2019t complete that request. Please try again.';

const looksLikeMissingApiKey = (rawBody: string): boolean => {
  const lowerBody = rawBody.toLowerCase();
  const mentionsApiKey = lowerBody.includes('api key') || lowerBody.includes('api-key');
  const mentions401 = lowerBody.includes('401') || lowerBody.includes('invalid_request_error');
  const mentionsNotConfigured = lowerBody.includes('is not configured');
  const mentionsNoKeyProvided = lowerBody.includes('didn\'t provide an api key')
    || lowerBody.includes('no api key provided');
  return mentionsNotConfigured || mentionsNoKeyProvided || (mentionsApiKey && mentions401 && !looksLikeInvalidApiKey(rawBody));
};

const looksLikeInvalidApiKey = (rawBody: string): boolean => {
  const lowerBody = rawBody.toLowerCase();
  return lowerBody.includes('incorrect api key')
    || lowerBody.includes('invalid_api_key')
    || lowerBody.includes('invalid api key');
};

const looksLikeRateLimited = (status: number, rawBody: string): boolean => {
  if (status === 429) {
    return true;
  }
  return rawBody.toLowerCase().includes('rate limit');
};

export const toFriendlyAgentError = (status: number, rawBody: string): string => {
  if (looksLikeInvalidApiKey(rawBody)) {
    return INVALID_KEY_MESSAGE;
  }

  if (looksLikeMissingApiKey(rawBody)) {
    return MISSING_KEY_MESSAGE;
  }

  if (looksLikeRateLimited(status, rawBody)) {
    return RATE_LIMITED_MESSAGE;
  }

  if (status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }

  return GENERIC_MESSAGE;
};
