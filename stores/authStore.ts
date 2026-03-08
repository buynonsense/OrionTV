import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CookieManager from "@react-native-cookies/cookies";
import { api } from "@/services/api";
import { LoginCredentialsManager } from "@/services/storage";
import { useSettingsStore } from "./settingsStore";
import Toast from "react-native-toast-message";
import Logger from "@/utils/Logger";

const logger = Logger.withTag('AuthStore');

const buildCookieHeaderFromStore = (cookies: Record<string, { value?: string }>): string =>
  Object.entries(cookies)
    .map(([name, cookie]) => {
      if (!cookie?.value) {
        return "";
      }

      return `${name}=${cookie.value}`;
    })
    .filter(Boolean)
    .join('; ');

const getNativeCookieHeader = async (apiBaseUrl: string): Promise<string> => {
  try {
    const nativeCookies = await CookieManager.get(apiBaseUrl);
    return buildCookieHeaderFromStore(nativeCookies);
  } catch {
    return '';
  }
};

const trySavedCredentialsLogin = async (): Promise<boolean> => {
  const savedCredentials = await LoginCredentialsManager.get();
  if (!savedCredentials?.password) {
    return false;
  }

  const loginResult = await api.login(savedCredentials.username, savedCredentials.password);
  return !!loginResult?.ok;
};

interface AuthState {
  isLoggedIn: boolean;
  isLoginModalVisible: boolean;
  showLoginModal: () => void;
  hideLoginModal: () => void;
  checkLoginStatus: (apiBaseUrl?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  isLoginModalVisible: false,
  showLoginModal: () => set({ isLoginModalVisible: true }),
  hideLoginModal: () => set({ isLoginModalVisible: false }),
  checkLoginStatus: async (apiBaseUrl?: string) => {
    if (!apiBaseUrl) {
      set({ isLoggedIn: false, isLoginModalVisible: false });
      return;
    }
    try {
      // Wait for server config to be loaded if it's currently loading
      const settingsState = useSettingsStore.getState();
      let serverConfig = settingsState.serverConfig;

      // If server config is loading, wait a bit for it to complete
      if (settingsState.isLoadingServerConfig) {
        // Wait up to 3 seconds for server config to load
        const maxWaitTime = 3000;
        const checkInterval = 100;
        let waitTime = 0;

        while (waitTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waitTime += checkInterval;
          const currentState = useSettingsStore.getState();
          if (!currentState.isLoadingServerConfig) {
            serverConfig = currentState.serverConfig;
            break;
          }
        }
      }

      if (!serverConfig?.StorageType) {
        // Only show error if we're not loading and have tried to fetch the config
        if (!settingsState.isLoadingServerConfig) {
          Toast.show({ type: "error", text1: "请检查网络或者服务器地址是否可用" });
        }
        return;
      }

      let authToken = await AsyncStorage.getItem('authCookies');
      if (!authToken) {
        authToken = await getNativeCookieHeader(apiBaseUrl);

        if (authToken) {
          await AsyncStorage.setItem('authCookies', authToken);
        }
      }

      if (!authToken) {
        if (serverConfig && serverConfig.StorageType === "localstorage") {
          const loginResult = await api.login().catch(() => {
            set({ isLoggedIn: false, isLoginModalVisible: true });
          });
          if (loginResult && loginResult.ok) {
            set({ isLoggedIn: true, isLoginModalVisible: false });
          }
        } else {
          const autoLoginSucceeded = await trySavedCredentialsLogin().catch((autoLoginError) => {
            logger.warn("Auto login with saved credentials failed:", autoLoginError);
            return false;
          });

          if (autoLoginSucceeded) {
            set({ isLoggedIn: true, isLoginModalVisible: false });
          } else {
            set({ isLoggedIn: false, isLoginModalVisible: true });
          }
        }
      } else {
        try {
          await api.getSearchHistory();
          set({ isLoggedIn: true, isLoginModalVisible: false });
        } catch (validationError) {
          if (validationError instanceof Error && validationError.message === "UNAUTHORIZED") {
            await AsyncStorage.setItem('authCookies', '');
            const autoLoginSucceeded = await trySavedCredentialsLogin().catch((autoLoginError) => {
              logger.warn("Auto re-login with saved credentials failed:", autoLoginError);
              return false;
            });

            if (autoLoginSucceeded) {
              set({ isLoggedIn: true, isLoginModalVisible: false });
            } else {
              set({ isLoggedIn: false, isLoginModalVisible: true });
            }
          } else {
            logger.error("Failed to validate login session:", validationError);
          }
        }
      }
    } catch (error) {
      logger.error("Failed to check login status:", error);
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        set({ isLoggedIn: false, isLoginModalVisible: true });
      } else {
        set({ isLoggedIn: false });
      }
    }
  },
  logout: async () => {
    try {
      await api.logout();
      set({ isLoggedIn: false, isLoginModalVisible: true });
    } catch (error) {
      logger.error("Failed to logout:", error);
    }
  },
}));

export default useAuthStore;
