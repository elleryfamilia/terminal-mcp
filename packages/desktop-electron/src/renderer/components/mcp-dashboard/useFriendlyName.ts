/**
 * Friendly Name Hook
 *
 * Generates deterministic friendly names from client IDs.
 * Uses a simple hash to select adjective + noun combinations.
 */

import { FRIENDLY_ADJECTIVES, FRIENDLY_NOUNS } from './types';

// Simple string hash function
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a friendly name from a client ID.
 * The name is deterministic - same clientId always produces same name.
 */
export function getFriendlyName(clientId: string): string {
  const hash = hashString(clientId);
  const adjIndex = hash % FRIENDLY_ADJECTIVES.length;
  const nounIndex = Math.floor(hash / FRIENDLY_ADJECTIVES.length) % FRIENDLY_NOUNS.length;

  return `${FRIENDLY_ADJECTIVES[adjIndex]} ${FRIENDLY_NOUNS[nounIndex]}`;
}

/**
 * Hook that memoizes friendly name generation.
 * Returns a function that generates friendly names with caching.
 */
export function useFriendlyName(): (clientId: string) => string {
  // Cache is created once and persists for the component's lifetime
  const cache = new Map<string, string>();

  return (clientId: string) => {
    let name = cache.get(clientId);
    if (!name) {
      name = getFriendlyName(clientId);
      cache.set(clientId, name);
    }
    return name;
  };
}
