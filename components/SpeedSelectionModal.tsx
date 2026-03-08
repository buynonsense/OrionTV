import React from "react";
import { View, Text, StyleSheet, Modal, FlatList } from "react-native";
import { StyledButton } from "./StyledButton";

import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import usePlayerStore from "@/stores/playerStore";

interface SpeedOption {
  rate: number;
  label: string;
}

const SPEED_OPTIONS: SpeedOption[] = [
  { rate: 0.5, label: "0.5x" },
  { rate: 0.75, label: "0.75x" },
  { rate: 1.0, label: "1x" },
  { rate: 1.25, label: "1.25x" },
  { rate: 1.5, label: "1.5x" },
  { rate: 1.75, label: "1.75x" },
  { rate: 2.0, label: "2x" },
];

export const SpeedSelectionModal: React.FC = () => {
  const { deviceType } = useResponsiveLayout();
  const { showSpeedModal, setShowSpeedModal, playbackRate, setPlaybackRate } = usePlayerStore();
  const numColumns = deviceType === "mobile" ? 2 : 3;

  const onSelectSpeed = (rate: number) => {
    setPlaybackRate(rate);
    setShowSpeedModal(false);
  };

  const onClose = () => {
    setShowSpeedModal(false);
  };

  return (
    <Modal visible={showSpeedModal} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, deviceType === "mobile" ? styles.mobileModalContent : deviceType === "tablet" ? styles.tabletModalContent : null]}>
          <View style={styles.headerRow}>
            <Text style={styles.modalTitle}>播放速度</Text>
            {deviceType !== "tv" && <StyledButton text="关闭" onPress={onClose} style={styles.closeButton} />}
          </View>
          <FlatList
            data={SPEED_OPTIONS}
            numColumns={numColumns}
            contentContainerStyle={styles.speedList}
            keyExtractor={(item) => `speed-${item.rate}`}
            renderItem={({ item }) => (
              <StyledButton
                text={item.label}
                onPress={() => onSelectSpeed(item.rate)}
                isSelected={playbackRate === item.rate}
                hasTVPreferredFocus={deviceType === "tv" && playbackRate === item.rate}
                style={[styles.speedItem, deviceType === "mobile" ? styles.mobileSpeedItem : null]}
                textStyle={styles.speedItemText}
              />
            )}
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
  modalContent: {
    width: 500,
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    padding: 20,
  },
  mobileModalContent: {
    width: "100%",
  },
  tabletModalContent: {
    width: 420,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  closeButton: {
    minWidth: 80,
  },
  modalTitle: {
    color: "white",
    marginBottom: 12,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
  },
  speedList: {
    justifyContent: "flex-start",
  },
  speedItem: {
    paddingVertical: 10,
    margin: 4,
    marginLeft: 10,
    marginRight: 8,
    width: "30%",
  },
  mobileSpeedItem: {
    width: "44%",
  },
  speedItemText: {
    fontSize: 16,
  },
});
