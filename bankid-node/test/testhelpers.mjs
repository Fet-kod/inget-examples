import fs from "node:fs/promises";
import path from "node:path";

function dateString(d) {
  return d.toISOString().replace(/[^a-zA-Z0-9 ]/g, "");
}

export const testStarted = new Date();
export const testLogsDir = path.resolve(
  "logs",
  `test-${dateString(testStarted)}`
);

export async function fileLogger(subDirectory) {
  const logDirectory = path.resolve(testLogsDir, subDirectory);
  await fs.mkdir(logDirectory, { recursive: true });

  return async function (filename, data) {
    const fullPath = path.resolve(logDirectory, filename);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
  };
}
