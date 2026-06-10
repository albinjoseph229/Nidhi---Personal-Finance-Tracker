// lib/aiKeyStore.ts
// Secure storage utility for user-provided AI API keys
// Uses expo-secure-store for encrypted on-device storage

import * as SecureStore from 'expo-secure-store';

export type AIProvider = 'gemini' | 'chatgpt';

const STORE_KEYS = {
  provider: 'nidhi_ai_provider',
  gemini: 'nidhi_ai_key_gemini',
  chatgpt: 'nidhi_ai_key_chatgpt',
};

/**
 * Save the selected AI provider
 */
export const setAIProvider = async (provider: AIProvider): Promise<void> => {
  await SecureStore.setItemAsync(STORE_KEYS.provider, provider);
};

/**
 * Get the currently selected AI provider
 */
export const getAIProvider = async (): Promise<AIProvider | null> => {
  const provider = await SecureStore.getItemAsync(STORE_KEYS.provider);
  if (provider === 'gemini' || provider === 'chatgpt') {
    return provider;
  }
  return null;
};

/**
 * Save an API key for a specific provider (stored encrypted on device)
 */
export const setAIKey = async (provider: AIProvider, key: string): Promise<void> => {
  await SecureStore.setItemAsync(STORE_KEYS[provider], key);
};

/**
 * Get the API key for a specific provider
 */
export const getAIKey = async (provider: AIProvider): Promise<string | null> => {
  return SecureStore.getItemAsync(STORE_KEYS[provider]);
};

/**
 * Delete the API key for a specific provider
 */
export const deleteAIKey = async (provider: AIProvider): Promise<void> => {
  await SecureStore.deleteItemAsync(STORE_KEYS[provider]);
};

/**
 * Check if the user has configured an AI provider and key
 */
export const hasAIKey = async (): Promise<boolean> => {
  const provider = await getAIProvider();
  if (!provider) return false;
  const key = await getAIKey(provider);
  return !!key && key.length > 0;
};

/**
 * Get the current provider and key (if configured)
 */
export const getAIConfig = async (): Promise<{
  provider: AIProvider | null;
  hasKey: boolean;
  maskedKey: string | null;
}> => {
  const provider = await getAIProvider();
  if (!provider) {
    return { provider: null, hasKey: false, maskedKey: null };
  }
  const key = await getAIKey(provider);
  const hasKey = !!key && key.length > 0;
  const maskedKey = key
    ? `${'•'.repeat(Math.max(0, key.length - 4))}${key.slice(-4)}`
    : null;

  return { provider, hasKey, maskedKey };
};

/**
 * Clear all AI configuration
 */
export const clearAllAIConfig = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(STORE_KEYS.provider);
  await SecureStore.deleteItemAsync(STORE_KEYS.gemini);
  await SecureStore.deleteItemAsync(STORE_KEYS.chatgpt);
};
