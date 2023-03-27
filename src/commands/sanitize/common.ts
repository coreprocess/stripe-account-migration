export type NonNullableKey<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

export function removeNull<T extends Object>(data: T): NonNullableKey<T> {
  return JSON.parse(
    JSON.stringify(data, (_, value) => {
      return value === null ? undefined : value;
    })
  );
}
