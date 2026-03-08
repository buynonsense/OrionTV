import React, { useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import useAuthStore from "@/stores/authStore";
import useFavoritesStore from "@/stores/favoritesStore";
import { Favorite } from "@/services/storage";
import VideoCard from "@/components/VideoCard";
import { api } from "@/services/api";
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { useSettingsStore } from "@/stores/settingsStore";
import Logger from "@/utils/Logger";

const logger = Logger.withTag('FavoritesScreen');

export default function FavoritesScreen() {
  const { favorites, loading, error, fetchFavorites } = useFavoritesStore();
  const { isLoggedIn, checkLoginStatus } = useAuthStore();
  const { apiBaseUrl } = useSettingsStore();

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  useFocusEffect(
    useCallback(() => {
      if (!apiBaseUrl) {
        return;
      }

      let isActive = true;

      const refreshFavoritesOnFocus = async () => {
        await checkLoginStatus(apiBaseUrl);
        if (!isActive) {
          return;
        }

        if (useAuthStore.getState().isLoggedIn) {
          await fetchFavorites();
        }
      };

      void refreshFavoritesOnFocus().catch((focusError) => {
        logger.warn("Failed to refresh favorites on focus:", focusError);
      });

      return () => {
        isActive = false;
      };
    }, [apiBaseUrl, checkLoginStatus, fetchFavorites])
  );

  useEffect(() => {
    if (!apiBaseUrl) {
      return;
    }

    if (isLoggedIn) {
      void fetchFavorites().catch((favoritesError) => {
        logger.warn("Failed to fetch favorites after login check:", favoritesError);
      });
      return;
    }

  }, [apiBaseUrl, fetchFavorites, isLoggedIn]);

  const renderItem = ({ item }: { item: Favorite & { key: string }; index: number }) => {
    const [source, id] = item.key.split("+");
    return (
      <VideoCard
        id={id}
        source={source}
        title={item.title}
        sourceName={item.source_name}
        poster={item.cover}
        year={item.year}
        api={api}
        episodeIndex={1}
        progress={0}
      />
    );
  };

  // 动态样式
  const dynamicStyles = createResponsiveStyles(deviceType, spacing);

  const renderFavoritesContent = () => (
    <>
      {deviceType === 'tv' && (
        <View style={dynamicStyles.headerContainer}>
          <ThemedText style={dynamicStyles.headerTitle}>我的收藏</ThemedText>
        </View>
      )}
      <CustomScrollView
        data={favorites}
        renderItem={renderItem}
        loading={loading}
        error={error}
        emptyMessage="暂无收藏"
      />
    </>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {renderFavoritesContent()}
    </ThemedView>
  );

  // 根据设备类型决定是否包装在响应式导航中
  if (deviceType === 'tv') {
    return content;
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="我的收藏" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isMobile = deviceType === 'mobile';
  const isTablet = deviceType === 'tablet';
  const isTV = deviceType === 'tv';

  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: isTV ? spacing * 2 : 0,
    },
    headerContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing * 1.5,
      marginBottom: spacing / 2,
    },
    headerTitle: {
      fontSize: isMobile ? 24 : isTablet ? 28 : 32,
      fontWeight: "bold",
      paddingTop: spacing,
      color: 'white',
    },
  });
};
