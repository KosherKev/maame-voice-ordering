import { supabase } from '../supabase';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '/v1';

export class ApiError extends Error {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: Array<{ detail: string; pointer: string }>;

  constructor(problem: {
    type: string;
    title: string;
    status: number;
    detail: string;
    errors?: Array<{ detail: string; pointer: string }>;
  }) {
    super(problem.detail);
    this.type = problem.type;
    this.title = problem.title;
    this.status = problem.status;
    this.detail = problem.detail;
    this.errors = problem.errors;
  }
}

/**
 * Maps the RFC 9457 problem type URI suffix to a clear, human-readable user message
 */
export function getFriendlyErrorMessage(error: any): string {
  if (!(error instanceof ApiError)) {
    return error.message || 'An unexpected connection error occurred. Please check your network.';
  }

  const typeSuffix = error.type.split('/').pop() || '';

  switch (typeSuffix) {
    case 'validation-error':
      if (error.errors && error.errors.length > 0) {
        return `Validation failed: ${error.errors.map((e) => e.detail).join(', ')}`;
      }
      return error.detail || 'The fields you entered are invalid.';
    case 'unauthorized':
      return 'Your session has expired or is invalid. Please log in again.';
    case 'invalid-credentials':
      return 'Incorrect email or password. Please try again.';
    case 'forbidden':
      return 'You do not have administrative permissions to perform this action.';
    case 'not-found':
      return 'The requested record could not be located.';
    case 'idempotency-conflict':
      return 'This request was already processed. Duplicate submissions are blocked.';
    case 'fulfillment-already-delivered':
      return 'This order has already been marked as delivered.';
    case 'invalid-state-transition':
      return error.detail || 'This action is invalid in the order\'s current state.';
    case 'webhook-signature-invalid':
      return 'Webhook verification failed.';
    case 'rate-limited':
      return 'Too many requests. Please slow down and try again.';
    case 'upstream-provider-error':
      return 'Upstream telecom or payment providers are currently unavailable. Please retry shortly.';
    case 'internal-error':
    default:
      return 'An internal server error occurred. Please try again later or contact support.';
  }
}

/**
 * Fetches data from the custom backend with automatic token injection and error handling
 */
export async function fetchFromBackend(endpoint: string, options: RequestInit = {}): Promise<any> {
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token;

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${BACKEND_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let problem;
    try {
      problem = await response.json();
    } catch (err) {
      throw new Error(`Connection error: ${response.status} ${response.statusText}`);
    }

    if (problem && problem.type && problem.detail) {
      throw new ApiError(problem);
    } else {
      throw new Error(problem.message || `API error: ${response.status}`);
    }
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
