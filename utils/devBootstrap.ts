import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '@/services/api';
import { LoginCredentialsManager, SettingsManager, type AppSettings } from '@/services/storage';
import Logger from '@/utils/Logger';

const logger = Logger.withTag('DevBootstrap');

const normalizeApiBaseUrl = (url: string): string => {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return '';
  }

  const withoutTrailingSlash = trimmedUrl.endsWith('/') ? trimmedUrl.slice(0, -1) : trimmedUrl;

  if (/^https?:\/\//i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  const hostPart = withoutTrailingSlash.split('/')[0];
  const isIpAddress = /^((\d{1,3}\.){3}\d{1,3})(:\d+)?$/.test(hostPart);
  const hasPort = /:\d+/.test(hostPart);

  return `${isIpAddress || hasPort ? 'http' : 'https'}://${withoutTrailingSlash}`;
};

const getDevBootstrapConfig = () => {
  const apiBaseUrl = normalizeApiBaseUrl(process.env.EXPO_PUBLIC_DEV_API_BASE_URL ?? '');
  const m3uUrl = (process.env.EXPO_PUBLIC_DEV_M3U_URL ?? '').trim();
  const username = (process.env.EXPO_PUBLIC_DEV_USERNAME ?? '').trim();
  const password = process.env.EXPO_PUBLIC_DEV_PASSWORD ?? '';

  return {
    apiBaseUrl,
    m3uUrl,
    username,
    password,
  };
};

export const applyDevBootstrap = async (): Promise<void> => {
  if (!__DEV__) {
    return;
  }

  const { apiBaseUrl, m3uUrl, username, password } = getDevBootstrapConfig();

  if (!apiBaseUrl) {
    return;
  }

  const currentSettings = await SettingsManager.get();
  const nextSettings: Partial<AppSettings> = {
    apiBaseUrl,
  };

  if (m3uUrl) {
    nextSettings.m3uUrl = m3uUrl;
  }

  const hasSettingsChanged =
    currentSettings.apiBaseUrl !== nextSettings.apiBaseUrl ||
    (nextSettings.m3uUrl !== undefined && currentSettings.m3uUrl !== nextSettings.m3uUrl);

  if (hasSettingsChanged) {
    await SettingsManager.save(nextSettings);
    await AsyncStorage.setItem('authCookies', '');
    logger.info('Applied development bootstrap settings');
  }

  api.setBaseUrl(apiBaseUrl);

  if (!username || !password) {
    return;
  }

  await LoginCredentialsManager.save({ username, password });

  try {
    await api.login(username, password);
    logger.info('Applied development bootstrap login');
  } catch (error) {
    logger.error('Failed to apply development bootstrap login:', error);
  }
};
