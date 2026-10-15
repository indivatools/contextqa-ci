/** Scoped API tokens minted by `POST /api/tokens` carry this prefix. */
const API_TOKEN_PREFIX = 'token_';

/**
 * Two credentials are accepted. A scoped API token goes in `Authorization`; the
 * legacy CI token (from `GET /api/public/token/ci`) goes in a `token` header,
 * so pipelines created before API tokens existed keep working.
 */
export function isApiToken(token: string): boolean {
  return token.startsWith(API_TOKEN_PREFIX);
}

export function authHeaders(token: string): Record<string, string> {
  return isApiToken(token) ? { Authorization: `Bearer ${token}` } : { token };
}
