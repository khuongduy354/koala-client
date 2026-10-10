const IDLE_THRESHOLD_MS = 1e4;
function isLive(task, now, idleThresholdMs = IDLE_THRESHOLD_MS) {
  return !!(task.pty?.running && task.pty.lastOutputAt && now - new Date(task.pty.lastOutputAt).getTime() < idleThresholdMs);
}
export {
  IDLE_THRESHOLD_MS,
  isLive
};
