import runtime from '../auth-runtime.cjs';
import { setTimeout as delay } from "node:timers/promises";
import { emitKeypressEvents } from "node:readline";
import { isLive } from "./task-activity.mjs";
import { WaitingTone } from "./waiting-tone.mjs";
import { TaskSelection } from "./task-selection.mjs";
import { loadTracking, saveTracking } from "./tracking-store.mjs";
const { daemonJson, resolveDaemonBaseUrl, flattenControlChars, formatTaskHandle, getShortTaskId, STATUS_EMOJI, KOALA_DIR } = runtime;
function activityLabel(task, now) {
  if (task.pty?.running === false) return "stopped";
  if (task.pty?.running !== true) return "unknown";
  if (task.needsInput) return "waiting for input";
  if (!task.pty.lastOutputAt || !Number.isFinite(Date.parse(task.pty.lastOutputAt))) return "unknown";
  return isLive(task, now) ? "live" : "idle";
}
function waitingCount(tasks) {
  return tasks.filter((task) => task.status === "active" && task.pty?.running === true && task.needsInput).length;
}
function orderedTasks(tasks) {
  return tasks.filter((task) => task.status === "active").sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || a.id.localeCompare(b.id));
}
function formatClientStatus(tasks, server, now = Date.now(), selection, width = Infinity) {
  const sorted = orderedTasks(tasks);
  const lines = [`koala daemon: ${flattenControlChars(server)}`, ""];
  for (const task of sorted) {
    const activity = activityLabel(task, now);
    const badge = activity === "waiting for input" ? STATUS_EMOJI.paused : activity === "live" ? STATUS_EMOJI.active : "\xB7";
    const selected = selection ? `${selection.tasks[selection.cursor]?.id === task.id ? ">" : " "} [${selection.isTracked(task.id) ? "x" : " "}] ` : "";
    const prefix = `${selected}${badge} ${formatTaskHandle(task.id)}  ${getShortTaskId(task.id)}  ${activity.padEnd(17)}  `;
    const available = Math.max(0, width - Array.from(prefix).length - 1);
    const title = Array.from(flattenControlChars(task.title));
    lines.push(`${prefix}${title.length > available ? title.slice(0, Math.max(0, available - 1)).join("") + "\u2026" : title.join("")}`);
  }
  if (!sorted.length) lines.push("no active tasks. the whole grove is napping.");
  return `${lines.join("\n")}
`;
}
async function showClientStatus(watch, sound = false) {
  if (sound && !watch) throw new Error("waiting sound needs a live view. run `koala --sound`.");
  if (watch && !process.stdout.isTTY) {
    throw new Error("couldn't watch tasks without a terminal. run `koala status` for a snapshot.");
  }
  const controller = new AbortController();
  const tone = sound ? new WaitingTone() : null;
  const server = resolveDaemonBaseUrl();
  const selection = new TaskSelection(watch ? await loadTracking(KOALA_DIR, server) : void 0);
  const interactive = watch && !!process.stdin.isTTY;
  const wasRaw = process.stdin.isRaw;
  let soundWork = Promise.resolve();
  let saveWork = Promise.resolve();
  let failure;
  const updateSound = () => {
    soundWork = soundWork.then(async () => {
      if (!controller.signal.aborted) await tone?.update(waitingCount(selection.tracked));
    }).catch((err) => {
      failure = err;
      stop();
    });
    return soundWork;
  };
  const render = () => {
    const height = Math.max(1, (process.stdout.rows || 24) - 7);
    const start = Math.max(0, Math.min(selection.cursor - height + 1, selection.tasks.length - height));
    const visible = interactive ? selection.tasks.slice(start, start + height) : selection.tasks;
    const text = formatClientStatus(
      visible,
      resolveDaemonBaseUrl(),
      Date.now(),
      interactive ? selection : void 0,
      watch ? process.stdout.columns || 100 : Infinity
    );
    const summary = sound ? `${waitingCount(selection.tracked)} waiting / ${selection.tracked.length} tracked. C-octave harmony on.
` : "sound off. start with --sound to hear tracked tasks.\n";
    const controls = interactive ? "\u2191/\u2193 move \xB7 space select \xB7 a all \xB7 n none \xB7 q quit. selections saved.\n" : "";
    process.stdout.write(watch ? `\x1B[H\x1B[2J${text}
${summary}${controls}refreshing every three seconds. ctrl+c to quit.
` : text);
  };
  const stop = () => {
    controller.abort();
    tone?.stop();
  };
  const keypress = (_text, key) => {
    if (key.name === "q" || key.ctrl && key.name === "c") {
      stop();
      return;
    }
    if (selection.key(key.name || "")) {
      render();
      void updateSound();
      if (["space", "a", "n"].includes(key.name || "")) {
        const state = selection.snapshot();
        saveWork = saveWork.then(() => saveTracking(KOALA_DIR, server, state)).catch((err) => {
          failure = err;
          stop();
        });
      }
    }
  };
  if (watch) {
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  }
  try {
    if (interactive) {
      emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      process.stdin.on("keypress", keypress);
      process.stdin.once("end", stop);
      process.stdin.resume();
      process.stdout.write("\x1B[?1049h\x1B[?25l");
    }
    do {
      const listing = await daemonJson("/api/tasks?status=active", {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3e4)])
      });
      if (controller.signal.aborted) break;
      selection.update(orderedTasks(listing.items));
      await updateSound();
      if (controller.signal.aborted) {
        tone?.stop();
        break;
      }
      render();
      if (!watch) break;
      await delay(3e3, void 0, { signal: controller.signal });
    } while (!controller.signal.aborted);
  } catch (err) {
    if (failure) throw failure;
    if (!controller.signal.aborted) throw err;
  } finally {
    controller.abort();
    await soundWork;
    await saveWork;
    tone?.stop();
    if (interactive) {
      process.stdin.removeListener("keypress", keypress);
      process.stdin.removeListener("end", stop);
      process.stdin.setRawMode(!!wasRaw);
      process.stdin.pause();
      process.stdout.write("\x1B[?25h\x1B[?1049l");
    }
    if (watch) {
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    }
    if (failure) throw failure;
  }
}
export {
  formatClientStatus,
  showClientStatus,
  waitingCount
};
