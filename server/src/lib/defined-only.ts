export function definedOnly<T extends object>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(input) as Array<keyof T>) {
    const value = input[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
