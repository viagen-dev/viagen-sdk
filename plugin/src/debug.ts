let _enabled = false;

export function setDebug(enabled: boolean) {
  _enabled = enabled;
}

export function debug(label: string, ...args: unknown[]) {
  if (!_enabled) return;
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[viagen:${label} ${ts}]`, ...args);
}
