type Primitive = string | number | boolean | symbol | null | undefined;

type DeepMerge<T, U> = T extends Primitive
  ? U
  : T extends Array<infer TItem>
    ? U extends Array<infer UItem>
      ? Array<DeepMerge<TItem, UItem>>
      : T
    : T extends object
      ? U extends object
        ? {
            [K in keyof T | keyof U]: K extends keyof U
              ? K extends keyof T
                ? DeepMerge<T[K], U[K]>
                : U[K]
              : K extends keyof T
                ? T[K]
                : never;
          }
        : T
      : U;

type DeepMergeAll<T extends unknown[]> = T extends [infer First, ...infer Rest]
  ? Rest extends []
    ? First
    : Rest extends unknown[]
      ? DeepMerge<First, DeepMergeAll<Rest>>
      : never
  : unknown;

export function mergeDeep<T extends unknown[]>(...sources: T): DeepMergeAll<T> {
  const isObject = (val: unknown): val is object => val !== null && typeof val === "object" && !Array.isArray(val);

  return sources.reduce((acc, source) => {
    if (Array.isArray(acc) && Array.isArray(source)) {
      const maxLength = Math.max(acc.length, source.length);
      const result: unknown[] = [];

      for (let i = 0; i < maxLength; i++) {
        const a = acc[i];
        const b = source[i];

        if (isObject(a) && isObject(b)) {
          result[i] = mergeDeep(a, b);
        } else {
          result[i] = b ?? a;
        }
      }

      return result;
    }

    if (isObject(acc) && isObject(source)) {
      const result: Record<string, unknown> = { ...(acc as Record<string, unknown>) };

      for (const [key, val] of Object.entries(source)) {
        const aVal = (acc as Record<string, unknown>)[key];

        if (isObject(aVal) && isObject(val)) {
          result[key] = mergeDeep(aVal, val);
        } else {
          result[key] = val;
        }
      }

      return result;
    }

    return source;
  }) as DeepMergeAll<T>;
}

export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
  return `${Number.parseInt(result[1], 16)}, ${Number.parseInt(result[2], 16)}, ${Number.parseInt(result[3], 16)}`;
}
