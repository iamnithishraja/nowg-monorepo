/**
 * Utility function to conditionally join classNames together
 */
export function classNames(
  ...classes: (string | boolean | undefined | null | Record<string, boolean>)[]
): string {
  return classes
    .filter(Boolean)
    .map((cls) => {
      if (typeof cls === "string") {
        return cls;
      }

      if (typeof cls === "object" && cls !== null) {
        return Object.entries(cls)
          .filter(([_, value]) => value)
          .map(([key]) => key)
          .join(" ");
      }

      return "";
    })
    .join(" ")
    .trim();
}
