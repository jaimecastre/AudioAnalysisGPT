export const HttpMethod = {
  DELETE: 'DELETE',
  GET: 'GET',
  PATCH: 'PATCH',
  POST: 'POST',
  PUT: 'PUT',
} as const;

export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

export interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: HttpMethod;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  readonly response: Response | undefined;
  readonly status: number;
  readonly statusText: string;

  constructor(message: string, status: number, statusText: string, response?: Response) {
    super(message);
    this.name = 'ApiError';
    this.response = response;
    this.status = status;
    this.statusText = statusText;
  }
}

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: 'application/json',
};

const API_BASE_URL = 'http://localhost:5146';

const buildUrl = (endpoint: string): string => {
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${baseUrl}${cleanEndpoint}`;
};

async function request(endpoint: string, options: RequestOptions = {}): Promise<Response> {
  const { body, headers = {}, method = HttpMethod.GET, signal } = options;
  const url = buildUrl(endpoint);

  const isFormData = body instanceof FormData;

  const isJsonBody = body !== undefined && !isFormData && method !== HttpMethod.GET;

  const requestInit: RequestInit = {
    headers: isFormData
      ? { ...headers }
      : isJsonBody
        ? { ...DEFAULT_HEADERS, 'Content-Type': 'application/json', ...headers }
        : { ...DEFAULT_HEADERS, ...headers },
    method,
    signal,
  };

  if (body !== undefined && method !== HttpMethod.GET) {
    requestInit.body = isFormData ? body : JSON.stringify(body);
  }

  const response = await fetch(url, requestInit);

  if (!response.ok) {
    throw new ApiError(
      `API request failed: ${response.status} ${response.statusText}`,
      response.status,
      response.statusText,
      response,
    );
  }

  return response;
}

async function requestJson<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  const response = await request(endpoint, options);
  return response.json();
}

export const apiClient = {
  request,
  requestJson,
  buildUrl,
};
