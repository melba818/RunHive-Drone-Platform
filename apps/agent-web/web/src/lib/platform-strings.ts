/** Retain upstream wording; change the platform display brand only. */
const cache = new WeakMap<object, unknown>();
export function platformStrings<T>(value: T): T {
  if (typeof value === 'string') return value.replaceAll('PenguinHarness', 'Agent中心').replaceAll('Penguin Harness', 'Agent中心') as T;
  if (typeof value === 'function') {
    if (!/PenguinHarness|Penguin Harness/.test(value.toString())) return value;
    const cached = cache.get(value);
    if (cached) return cached as T;
    const wrapped = (...args: unknown[]) => platformStrings(Reflect.apply(value, undefined, args));
    cache.set(value, wrapped);
    return wrapped as T;
  }
  if (!value || typeof value !== 'object') return value;
  const cached = cache.get(value);
  if (cached) return cached as T;
  const result = Array.isArray(value) ? value.map(platformStrings) : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, platformStrings(item)]));
  cache.set(value, result);
  return result as T;
}
