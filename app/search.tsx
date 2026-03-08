import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, TextInput, StyleSheet, Alert, Keyboard, TouchableOpacity } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import VideoCard from "@/components/VideoCard";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import { api, SearchResult } from "@/services/api";
import { Search, QrCode } from "lucide-react-native";
import { StyledButton } from "@/components/StyledButton";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import useAuthStore from "@/stores/authStore";
import { RemoteControlModal } from "@/components/RemoteControlModal";
import { useSettingsStore } from "@/stores/settingsStore";
import { LoginCredentialsManager } from "@/services/storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { DeviceUtils } from "@/utils/DeviceUtils";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('SearchScreen');

export default function SearchScreen() {
  const { q: initialQueryParam } = useLocalSearchParams<{ q?: string }>();
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const appliedInitialQueryRef = useRef<string | null>(null);
  const pendingInitialQueryRef = useRef<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { isLoggedIn, checkLoginStatus } = useAuthStore();
  const { remoteInputEnabled, apiBaseUrl } = useSettingsStore();
  const router = useRouter();

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  const searchWithFallback = useCallback(async (term: string): Promise<SearchResult[]> => {
    let fallbackError: unknown = null;

    try {
      const response = await api.searchVideos(term);
      if (response.results.length > 0) {
        return response.results;
      }
    } catch (error) {
      fallbackError = error;
      logger.info("Primary search failed, trying resource fallback:", error);
    }

    try {
      const resources = await api.getResources();
      const fallbackResults = await Promise.all(
        resources.map(async (resource) => {
          try {
            const response = await api.searchVideo(term, resource.key);
            return response.results;
          } catch {
            return [];
          }
        })
      );

      const dedupedResults = new Map<string, SearchResult>();
      fallbackResults.flat().forEach((item) => {
        dedupedResults.set(`${item.source}-${item.id}`, item);
      });

      return Array.from(dedupedResults.values());
    } catch (error) {
      logger.info("Fallback search failed:", error);
      throw fallbackError ?? error;
    }
  }, []);

  const handleSearch = useCallback(async (searchText?: string, allowRetry: boolean = true): Promise<boolean> => {
    const term = typeof searchText === "string" ? searchText : keyword;
    if (!term.trim()) {
      Keyboard.dismiss();
      return false;
    }
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
      const nextResults = await searchWithFallback(term);
      if (nextResults.length > 0) {
        setResults(nextResults);
        return true;
      } else {
        setResults([]);
        setError("没有找到相关内容");
      }
    } catch (err) {
      if (allowRetry && err instanceof Error && err.message === "UNAUTHORIZED" && apiBaseUrl) {
        const savedCredentials = await LoginCredentialsManager.get();
        if (savedCredentials?.password) {
          try {
            await api.login(savedCredentials.username, savedCredentials.password);
            return await handleSearch(term, false);
          } catch (loginError) {
            logger.info("Search retry login failed:", loginError);
          }
        }

        await checkLoginStatus(apiBaseUrl);

        if (useAuthStore.getState().isLoggedIn) {
          return await handleSearch(term, false);
        }
      }

      setResults([]);
      const errorMessage = err instanceof Error ? err.message : "未知错误";
      setError(__DEV__ ? `搜索失败：${errorMessage}` : "搜索失败，请稍后重试。");
      logger.info("Search failed:", err);
    } finally {
      setLoading(false);
    }
    return false;
  }, [apiBaseUrl, checkLoginStatus, keyword, searchWithFallback]);

  useEffect(() => {
    if (!apiBaseUrl) {
      return;
    }

    void checkLoginStatus(apiBaseUrl).catch((error) => {
      logger.warn("Failed to check login status on search screen:", error);
    });
  }, [apiBaseUrl, checkLoginStatus]);

  useEffect(() => {
    const initialQuery = typeof initialQueryParam === "string" ? initialQueryParam.trim() : "";
    if (
      !apiBaseUrl ||
      !isLoggedIn ||
      !initialQuery ||
      appliedInitialQueryRef.current === initialQuery ||
      pendingInitialQueryRef.current === initialQuery
    ) {
      return;
    }

    pendingInitialQueryRef.current = initialQuery;
    setKeyword(initialQuery);

    const runInitialSearch = async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const foundResults = await handleSearch(initialQuery);
        if (foundResults) {
          appliedInitialQueryRef.current = initialQuery;
          pendingInitialQueryRef.current = null;
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      pendingInitialQueryRef.current = null;
    };

    void runInitialSearch().catch((error) => {
      logger.warn("Initial deep-link search failed unexpectedly:", error);
    });
  }, [apiBaseUrl, handleSearch, initialQueryParam, isLoggedIn]);

  useEffect(() => {
    if (lastMessage && targetPage === 'search') {
      logger.debug("Received remote input:", lastMessage);
      const realMessage = lastMessage.split("_")[0];
      setKeyword(realMessage);
      void handleSearch(realMessage).catch((error) => {
        logger.warn("Remote input search failed unexpectedly:", error);
      });
      clearMessage();
    }
  }, [lastMessage, targetPage, handleSearch, clearMessage]);

  const onSearchPress = useCallback(() => {
    void handleSearch().catch((error) => {
      logger.warn("Manual search failed unexpectedly:", error);
    });
  }, [handleSearch]);

  const handleQrPress = () => {
    if (!remoteInputEnabled) {
      Alert.alert("远程输入未启用", "请先在设置页面中启用远程输入功能", [
        { text: "取消", style: "cancel" },
        { text: "去设置", onPress: () => router.push("/settings") },
      ]);
      return;
    }
    showRemoteModal('search');
  };

  const renderItem = ({ item }: { item: SearchResult; index: number }) => (
    <VideoCard
      id={item.id.toString()}
      source={item.source}
      title={item.title}
      poster={item.poster}
      year={item.year}
      sourceName={item.source_name}
      api={api}
    />
  );

  // 动态样式
  const dynamicStyles = createResponsiveStyles(deviceType, spacing);

  const renderSearchContent = () => (
    <>
      <View style={dynamicStyles.searchContainer}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            dynamicStyles.inputContainer,
            {
              borderColor: isInputFocused ? Colors.dark.primary : "transparent",
            },
          ]}
          onPress={() => textInputRef.current?.focus()}
        >
          <TextInput
            ref={textInputRef}
            style={dynamicStyles.input}
            placeholder="搜索电影、剧集..."
            placeholderTextColor="#888"
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={onSearchPress}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            returnKeyType="search"
          />
        </TouchableOpacity>
        <StyledButton style={dynamicStyles.searchButton} onPress={onSearchPress}>
          <Search size={deviceType === 'mobile' ? 20 : 24} color="white" />
        </StyledButton>
        {deviceType === 'tv' && (
          <StyledButton style={dynamicStyles.qrButton} onPress={handleQrPress}>
            <QrCode size={deviceType === 'tv' ? 24 : 20} color="white" />
          </StyledButton>
        )}
      </View>

      {loading ? (
        <VideoLoadingAnimation showProgressBar={false} />
      ) : error ? (
        <View style={[commonStyles.center, { flex: 1 }]}>
          <ThemedText style={dynamicStyles.errorText}>{error}</ThemedText>
        </View>
      ) : (
        <CustomScrollView
          data={results}
          renderItem={renderItem}
          loading={loading}
          error={error}
          emptyMessage="输入关键词开始搜索"
        />
      )}
      <RemoteControlModal />
    </>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {renderSearchContent()}
    </ThemedView>
  );

  // 根据设备类型决定是否包装在响应式导航中
  if (deviceType === 'tv') {
    return content;
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="搜索" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isMobile = deviceType === 'mobile';
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();

  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: deviceType === 'tv' ? 50 : 0,
    },
    searchContainer: {
      flexDirection: "row",
      paddingHorizontal: spacing,
      marginBottom: spacing,
      alignItems: "center",
      paddingTop: isMobile ? spacing / 2 : 0,
    },
    inputContainer: {
      flex: 1,
      height: isMobile ? minTouchTarget : 50,
      backgroundColor: "#2c2c2e",
      borderRadius: isMobile ? 8 : 8,
      marginRight: spacing / 2,
      borderWidth: 2,
      borderColor: "transparent",
      justifyContent: "center",
    },
    input: {
      flex: 1,
      paddingHorizontal: spacing,
      color: "white",
      fontSize: isMobile ? 16 : 18,
    },
    searchButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: isMobile ? 8 : 8,
      marginRight: deviceType !== 'mobile' ? spacing / 2 : 0,
    },
    qrButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: isMobile ? 8 : 8,
    },
    errorText: {
      color: "red",
      fontSize: isMobile ? 14 : 16,
      textAlign: "center",
    },
  });
};
