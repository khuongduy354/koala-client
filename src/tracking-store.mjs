import runtime from '../auth-runtime.cjs';
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const { normalizeServerUrl, writeFileAtomic } = runtime;
function selectionPath(root, server) {
  const key = createHash("sha256").update(normalizeServerUrl(server)).digest("hex");
  return join(root, "client-tracking", `${key}.json`);
}
async function loadTracking(root, server) {
  try {
    const state = JSON.parse(await readFile(selectionPath(root, server), "utf8"));
    if (!state || typeof state.defaultTracked !== "boolean" || !Array.isArray(state.exceptions) || !state.exceptions.every((id) => typeof id === "string")) throw new Error("invalid selection");
    return state;
  } catch (err) {
    if (err.code === "ENOENT") return void 0;
    throw new Error("couldn't read saved sound selection. check the client-tracking files in your koala directory.");
  }
}
async function saveTracking(root, server, state) {
  try {
    await mkdir(join(root, "client-tracking"), { recursive: true, mode: 448 });
    await writeFileAtomic(selectionPath(root, server), JSON.stringify(state), { mode: 384 });
  } catch {
    throw new Error("couldn't save sound selection. check your koala directory permissions.");
  }
}
export {
  loadTracking,
  saveTracking
};
