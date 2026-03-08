import { useState, useEffect, useCallback, useRef } from "react";
import { View, FlatList, StyleSheet, ActivityIndicator, Modal, useTVEventHandler, type HWEvent, Text } from "react-native";
import { useRouter } from "expo-router";
import { ListVideo } from "lucide-react-native";
import LivePlayer from "@/components/LivePlayer";
import { fetchAndParseM3u, getPlayableUrl, type Channel } from "@/services/m3u";
import { ThemedView } from "@/components/ThemedView";
import { StyledButton } from "@/components/StyledButton";
import { useSettingsStore } from "@/stores/settingsStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { DeviceUtils } from "@/utils/DeviceUtils";

export default function LiveScreen() {
  const router = useRouter();
  const { m3uUrl } = useSettingsStore();
  
  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [groupedChannels, setGroupedChannels] = useState<Record<string, Channel[]>>({});
  const [channelGroups, setChannelGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  const [currentChannelIndex, setCurrentChannelIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isChannelListVisible, setIsChannelListVisible] = useState(false);
  const [channelTitle, setChannelTitle] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const titleTimer = useRef<NodeJS.Timeout | null>(null);

  const selectedChannelUrl = channels.length > 0 ? getPlayableUrl(channels[currentChannelIndex].url) : null;

  const showChannelTitle = useCallback((title: string) => {
    setChannelTitle(title);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => setChannelTitle(null), 3000);
  }, []);

  useEffect(() => {
    const loadChannels = async () => {
      if (!m3uUrl) return;
      setIsLoading(true);
      setLoadError(null);

      const result = await fetchAndParseM3u(m3uUrl);
      const parsedChannels = result.channels;

      setChannels(parsedChannels);
      setLoadError(result.error);

      const groups: Record<string, Channel[]> = parsedChannels.reduce((acc, channel) => {
        const groupName = channel.group || "Other";
        if (!acc[groupName]) {
          acc[groupName] = [];
        }
        acc[groupName].push(channel);
        return acc;
      }, {} as Record<string, Channel[]>);

      const groupNames = Object.keys(groups);
      setGroupedChannels(groups);
      setChannelGroups(groupNames);
      setSelectedGroup(groupNames[0] || "");

      if (parsedChannels.length > 0) {
        showChannelTitle(parsedChannels[0].name);
      }
      setIsLoading(false);
    };
    loadChannels();
  }, [m3uUrl, showChannelTitle]);

  const handleSelectChannel = (channel: Channel) => {
    const globalIndex = channels.findIndex((c) => c.id === channel.id);
    if (globalIndex !== -1) {
      setCurrentChannelIndex(globalIndex);
      showChannelTitle(channel.name);
      setIsChannelListVisible(false);
    }
  };

  const changeChannel = useCallback(
    (direction: "next" | "prev") => {
      if (channels.length === 0) return;
      const newIndex =
        direction === "next"
          ? (currentChannelIndex + 1) % channels.length
          : (currentChannelIndex - 1 + channels.length) % channels.length;
      setCurrentChannelIndex(newIndex);
      showChannelTitle(channels[newIndex].name);
    },
    [channels, currentChannelIndex, showChannelTitle]
  );

  const handleTVEvent = useCallback(
    (event: HWEvent) => {
      if (deviceType !== 'tv') return;
      if (isChannelListVisible) return;
      if (event.eventType === "down") setIsChannelListVisible(true);
      else if (event.eventType === "left") changeChannel("prev");
      else if (event.eventType === "right") changeChannel("next");
    },
    [changeChannel, isChannelListVisible, deviceType]
  );

  useTVEventHandler(deviceType === 'tv' ? handleTVEvent : () => {});

  // 动态样式
  const dynamicStyles = createResponsiveStyles(deviceType, spacing);

  const renderLiveContent = () => (
    <>
      <LivePlayer 
        streamUrl={selectedChannelUrl} 
        channelTitle={channelTitle} 
        onPlaybackStatusUpdate={() => {}} 
      />
      {deviceType !== 'tv' && channels.length > 0 && (
        <View style={dynamicStyles.channelButtonContainer}>
          <StyledButton style={dynamicStyles.channelButton} onPress={() => setIsChannelListVisible(true)}>
            <ListVideo size={20} color="white" />
            <Text style={dynamicStyles.channelButtonText}>频道</Text>
          </StyledButton>
        </View>
      )}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isChannelListVisible}
        onRequestClose={() => setIsChannelListVisible(false)}
      >
        <View style={dynamicStyles.modalContainer}>
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>选择频道</Text>
              {deviceType !== 'tv' && (
                <StyledButton text="关闭" onPress={() => setIsChannelListVisible(false)} style={dynamicStyles.modalCloseButton} />
              )}
            </View>
            <View style={dynamicStyles.listContainer}>
              <View style={dynamicStyles.groupColumn}>
                <FlatList
                  data={channelGroups}
                  keyExtractor={(item, index) => `group-${item}-${index}`}
                  renderItem={({ item }) => (
                    <StyledButton
                      text={item}
                      onPress={() => setSelectedGroup(item)}
                      isSelected={selectedGroup === item}
                      style={dynamicStyles.groupButton}
                      textStyle={dynamicStyles.groupButtonText}
                    />
                  )}
                />
              </View>
              <View style={dynamicStyles.channelColumn}>
                {isLoading ? (
                  <ActivityIndicator size="large" />
                ) : (
                  <FlatList
                    data={groupedChannels[selectedGroup] || []}
                    keyExtractor={(item, index) => `${item.id}-${item.group}-${index}`}
                    renderItem={({ item }) => (
                      <StyledButton
                        text={item.name || "Unknown Channel"}
                        onPress={() => handleSelectChannel(item)}
                        isSelected={channels[currentChannelIndex]?.id === item.id}
                        hasTVPreferredFocus={deviceType === 'tv' && channels[currentChannelIndex]?.id === item.id}
                        style={dynamicStyles.channelItem}
                        textStyle={dynamicStyles.channelItemText}
                      />
                    )}
                  />
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );

  const renderEmptyState = (message: string, actionLabel?: string) => (
    <View style={dynamicStyles.emptyStateContainer}>
      <Text style={dynamicStyles.emptyStateTitle}>直播</Text>
      <Text style={dynamicStyles.emptyStateText}>{message}</Text>
      {actionLabel ? (
        <StyledButton style={dynamicStyles.emptyStateButton} onPress={() => router.push("/settings")}>
          <Text style={dynamicStyles.emptyStateButtonText}>{actionLabel}</Text>
        </StyledButton>
      ) : null}
    </View>
  );

  const renderContentBody = () => {
    if (!m3uUrl) {
      return renderEmptyState("请先在设置中填写直播源地址。", "去设置");
    }

    if (!isLoading && loadError) {
      return renderEmptyState(loadError, "去设置");
    }

    if (!isLoading && channels.length === 0) {
      return renderEmptyState("当前直播源没有可用频道，请检查地址后重试。", "去设置");
    }

    return renderLiveContent();
  };

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {renderContentBody()}
    </ThemedView>
  );

  // 根据设备类型决定是否包装在响应式导航中
  if (deviceType === 'tv') {
    return content;
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="直播" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isMobile = deviceType === 'mobile';
  const isTablet = deviceType === 'tablet';
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    modalContainer: {
      flex: 1,
      flexDirection: "row",
      justifyContent: isMobile ? "center" : "flex-end",
      backgroundColor: "transparent",
    },
    modalContent: {
      width: isMobile ? '90%' : isTablet ? 400 : 450,
      height: "100%",
      backgroundColor: "rgba(0, 0, 0, 0.85)",
      padding: spacing,
    },
    modalTitle: {
      color: "white",
      textAlign: "center",
      fontSize: isMobile ? 18 : 16,
      fontWeight: "bold",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing / 2,
    },
    modalCloseButton: {
      minWidth: 80,
    },
    listContainer: {
      flex: 1,
      flexDirection: isMobile ? "column" : "row",
    },
    groupColumn: {
      flex: isMobile ? 0 : 1,
      marginRight: isMobile ? 0 : spacing / 2,
      marginBottom: isMobile ? spacing : 0,
      maxHeight: isMobile ? 120 : undefined,
    },
    channelColumn: {
      flex: isMobile ? 1 : 2,
    },
    groupButton: {
      paddingVertical: isMobile ? minTouchTarget / 4 : 8,
      paddingHorizontal: spacing / 2,
      marginVertical: isMobile ? 2 : 4,
      minHeight: isMobile ? minTouchTarget * 0.7 : undefined,
    },
    groupButtonText: {
      fontSize: isMobile ? 14 : 13,
    },
    channelItem: {
      paddingVertical: isMobile ? minTouchTarget / 5 : 6,
      paddingHorizontal: spacing,
      marginVertical: isMobile ? 2 : 3,
      minHeight: isMobile ? minTouchTarget * 0.8 : undefined,
    },
    channelItemText: {
      fontSize: isMobile ? 14 : 12,
    },
    channelButtonContainer: {
      position: "absolute",
      right: spacing,
      bottom: spacing * 1.5,
    },
    channelButton: {
      minHeight: minTouchTarget,
      paddingHorizontal: spacing,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    channelButtonText: {
      color: "white",
      fontSize: isMobile ? 14 : 15,
      fontWeight: "600",
      marginLeft: 8,
    },
    emptyStateContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing * 2,
    },
    emptyStateTitle: {
      color: "white",
      fontSize: isMobile ? 24 : 28,
      fontWeight: "bold",
      marginBottom: spacing,
    },
    emptyStateText: {
      color: "#ccc",
      fontSize: isMobile ? 15 : 17,
      textAlign: "center",
      lineHeight: isMobile ? 22 : 26,
      marginBottom: spacing * 1.5,
    },
    emptyStateButton: {
      minWidth: isMobile ? 160 : 180,
      minHeight: minTouchTarget,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing * 1.5,
    },
    emptyStateButtonText: {
      color: "white",
      fontSize: isMobile ? 15 : 16,
      fontWeight: "600",
    },
  });
};
