/**
 * Mock for cloudflare:workers in tests
 * Returns empty env so ASSETS is undefined and code falls back to regular fetch
 */

export const env = {};
