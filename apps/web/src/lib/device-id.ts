const STORAGE_KEY = "amader_device_id";

// A stable per-browser identifier (ADDENDUM §E device-block path) — a
// random UUID persisted in localStorage, not a canvas/audio fingerprinting
// library. That's a real fraud-tooling category of its own the addendum
// doesn't ask for; a stable client-generated id is what "device blocks
// work" actually needs.
export function getDeviceId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}
