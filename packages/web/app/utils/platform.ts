/**
 * Platform detection utilities
 * These are memoized at module level to avoid repeated calculations
 */

let cachedIsApple: boolean | null = null;

/**
 * Detects if the current platform is Apple (Mac, iPhone, iPad, iPod)
 * Result is memoized to avoid repeated calculations
 */
export function isApplePlatform(): boolean {
  if (cachedIsApple !== null) {
    return cachedIsApple;
  }

  if (typeof navigator === "undefined") {
    // SSR - default to Mac since it's a common dev environment
    cachedIsApple = true;
    return cachedIsApple;
  }

  try {
    const ua = navigator.userAgent || "";
    const platform = (navigator.platform || "").toLowerCase();
    cachedIsApple =
      /mac|iphone|ipad|ipod/.test(platform) ||
      /Mac|iPhone|iPad|iPod/.test(ua);
  } catch {
    cachedIsApple = true;
  }

  return cachedIsApple;
}

/**
 * Returns the appropriate shortcut label for the current platform
 * Mac: "⌘ Return", Windows/Linux: "Ctrl+Enter"
 */
export function getShortcutLabel(): string {
  return isApplePlatform() ? "⌘ Return" : "Ctrl+Enter";
}

/**
 * Returns the appropriate modifier key for the current platform
 * Mac: "⌘", Windows/Linux: "Ctrl"
 */
export function getModifierKey(): string {
  return isApplePlatform() ? "⌘" : "Ctrl";
}
