import * as SecureStore from "expo-secure-store";

// iOS SecureStore rejects values larger than ~2048 bytes. Supabase sessions
// (especially OAuth) often exceed that, so large values are stored in chunks.
const CHUNK_SIZE = 2000;

function chunkKey(baseKey: string, index: number): string {
  return `${baseKey}_chunk_${index}`;
}

function countKey(baseKey: string): string {
  return `${baseKey}_chunk_count`;
}

async function removeLegacyAndChunks(baseKey: string): Promise<void> {
  await SecureStore.deleteItemAsync(baseKey).catch(() => {});
  const countRaw = await SecureStore.getItemAsync(countKey(baseKey));
  if (!countRaw) {
    return;
  }
  const count = Number.parseInt(countRaw, 10);
  if (Number.isFinite(count) && count > 0) {
    await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(baseKey, index)).catch(() => {})
      )
    );
  }
  await SecureStore.deleteItemAsync(countKey(baseKey)).catch(() => {});
}

export const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const countRaw = await SecureStore.getItemAsync(countKey(key));
    if (countRaw) {
      const count = Number.parseInt(countRaw, 10);
      if (!Number.isFinite(count) || count <= 0) {
        return null;
      }
      const chunks: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const chunk = await SecureStore.getItemAsync(chunkKey(key, index));
        if (chunk === null) {
          return null;
        }
        chunks.push(chunk);
      }
      return chunks.join("");
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await removeLegacyAndChunks(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let index = 0; index < count; index += 1) {
      await SecureStore.setItemAsync(
        chunkKey(key, index),
        value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)
      );
    }
    await SecureStore.setItemAsync(countKey(key), String(count));
  },
  removeItem: async (key: string): Promise<void> => {
    await removeLegacyAndChunks(key);
  }
};
