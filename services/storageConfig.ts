// Define a simple storage configuration service
export interface StorageConfig {
  storageType: string | undefined;
  getStorageType: () => string | undefined;
  setStorageType: (type: string | undefined) => void;
}

// Create a singleton instance
export const storageConfig: StorageConfig = {
  storageType: undefined,

  getStorageType() {
    return this.storageType;
  },

  setStorageType(type: string | undefined) {
    this.storageType = type;
  },
};
