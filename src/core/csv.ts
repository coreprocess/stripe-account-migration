import { stringify as callbackStringify, parse as callbackParse } from "csv";
import { promisify } from "util";

export const stringify = promisify<
  Array<Array<string>>,
  { header: boolean; columns: Array<{ key: string; header: string }> },
  string
>(callbackStringify);

const parse = promisify<string, { from_line: number }, Array<Array<string>>>(
  callbackParse
);

export async function mapToCsvString(data: Map<string, string>) {
  return await stringify(Array.from(data), {
    header: true,
    columns: [
      { key: "old_id", header: "old_id" },
      { key: "new_id", header: "new_id" },
    ],
  });
}

export async function csvStringToMap(csv: string) {
  const data = await parse(csv, { from_line: 1 });

  return new Map(
    data.map(([key_0, key_1]) => {
      return [key_0, key_1];
    })
  );
}
