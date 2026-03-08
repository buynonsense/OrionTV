import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, FlatList } from "react-native";
import { StyledButton } from "./StyledButton";

import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import usePlayerStore from "@/stores/playerStore";

export const EpisodeSelectionModal: React.FC = () => {
  const { showEpisodeModal, episodes, currentEpisodeIndex, playEpisode, setShowEpisodeModal } = usePlayerStore();
  const { deviceType } = useResponsiveLayout();

  const [episodeGroupSize] = useState(30);
  const [selectedEpisodeGroup, setSelectedEpisodeGroup] = useState(Math.floor(currentEpisodeIndex / episodeGroupSize));
  const numColumns = deviceType === "mobile" ? 3 : deviceType === "tablet" ? 4 : 5;
  const dynamicStyles = useMemo(() => createStyles(deviceType), [deviceType]);

  const onSelectEpisode = (index: number) => {
    playEpisode(index);
    setShowEpisodeModal(false);
  };

  const onClose = () => {
    setShowEpisodeModal(false);
  };

  return (
    <Modal visible={showEpisodeModal} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={dynamicStyles.modalContent}>
          <View style={dynamicStyles.headerRow}>
            <Text style={styles.modalTitle}>选择剧集</Text>
            {deviceType !== "tv" && <StyledButton text="关闭" onPress={onClose} style={dynamicStyles.closeButton} />}
          </View>

          {episodes.length > episodeGroupSize && (
            <View style={styles.episodeGroupContainer}>
              {Array.from({ length: Math.ceil(episodes.length / episodeGroupSize) }, (_, groupIndex) => (
                <StyledButton
                  key={`episode-group-${groupIndex * episodeGroupSize + 1}`}
                  text={`${groupIndex * episodeGroupSize + 1}-${Math.min(
                    (groupIndex + 1) * episodeGroupSize,
                    episodes.length
                  )}`}
                  onPress={() => setSelectedEpisodeGroup(groupIndex)}
                  isSelected={selectedEpisodeGroup === groupIndex}
                  style={styles.episodeGroupButton}
                  textStyle={styles.episodeGroupButtonText}
                />
              ))}
            </View>
          )}
          <FlatList
            data={episodes.slice(
              selectedEpisodeGroup * episodeGroupSize,
              (selectedEpisodeGroup + 1) * episodeGroupSize
            )}
            numColumns={numColumns}
            contentContainerStyle={styles.episodeList}
            keyExtractor={(_, index) => `episode-${selectedEpisodeGroup * episodeGroupSize + index}`}
            renderItem={({ item, index }) => {
              const absoluteIndex = selectedEpisodeGroup * episodeGroupSize + index;
              return (
                <StyledButton
                  text={item.title || `第 ${absoluteIndex + 1} 集`}
                  onPress={() => onSelectEpisode(absoluteIndex)}
                  isSelected={currentEpisodeIndex === absoluteIndex}
                  hasTVPreferredFocus={deviceType === "tv" && currentEpisodeIndex === absoluteIndex}
                  style={[styles.episodeItem, dynamicStyles.episodeItem]}
                  textStyle={styles.episodeItemText}
                />
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  modalTitle: {
    color: "white",
    marginBottom: 12,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
  },
  episodeList: {
    justifyContent: "flex-start",
  },
  episodeItem: {
    paddingVertical: 2,
    margin: 4,
  },
  episodeItemText: {
    fontSize: 14,
  },
  episodeGroupContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  episodeGroupButton: {
    paddingHorizontal: 6,
    margin: 8,
  },
  episodeGroupButtonText: {
    fontSize: 12,
  },
});

const createStyles = (deviceType: string) =>
  StyleSheet.create({
    modalContent: {
      width: deviceType === "mobile" ? "100%" : deviceType === "tablet" ? 520 : 600,
      height: "100%",
      backgroundColor: "rgba(0, 0, 0, 0.85)",
      padding: 20,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    closeButton: {
      minWidth: 80,
    },
    episodeItem: {
      width: deviceType === "mobile" ? "30%" : deviceType === "tablet" ? "22%" : "18%",
    },
  });
