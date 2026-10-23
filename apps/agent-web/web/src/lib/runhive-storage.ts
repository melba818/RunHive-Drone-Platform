/** Prefix every native UI preference/draft before importing application modules. */
export function scopedStorage(storage: Storage, adminId: number): Storage {
  if (!Number.isSafeInteger(adminId) || adminId <= 0) throw new Error('账号验证未完成。');
  const prefix = `runhive.agent.${adminId}.`;
  const keys = () => Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => !!key?.startsWith(prefix));
  return {
    get length() { return keys().length; },
    key: (index: number) => keys()[index]?.slice(prefix.length) ?? null,
    getItem: (key: string) => storage.getItem(prefix + key),
    setItem: (key: string, value: string) => storage.setItem(prefix + key, String(value)),
    removeItem: (key: string) => storage.removeItem(prefix + key),
    clear: () => keys().forEach((key) => storage.removeItem(key)),
  } as Storage;
}
