/**
 * Phosphor icon name to component mapping
 * Used for dynamic icon rendering by name
 */
import * as PhosphorIcons from "@phosphor-icons/react";

type PhosphorIconName = keyof typeof PhosphorIcons;

// Create a map of icon names to components
const phosphorIconMap = new Map<string, React.ComponentType<any>>();

// Populate the map with all phosphor icons
const populatePhosphorMap = () => {
  Object.entries(PhosphorIcons).forEach(([key, value]) => {
    if (
      typeof value === "function" &&
      key.charAt(0) === key.charAt(0).toUpperCase()
    ) {
      phosphorIconMap.set(key, value as React.ComponentType<any>);
    }
  });
};

// Only populate once on module load
populatePhosphorMap();

export function getPhosphorIcon(
  name: string
): React.ComponentType<any> | null {
  return phosphorIconMap.get(name) || null;
}

export function renderPhosphorIcon(
  name: string,
  props?: {
    size?: number | string;
    color?: string;
    weight?: string;
    className?: string;
  }
) {
  const IconComponent = getPhosphorIcon(name);
  if (!IconComponent) {
    console.warn(`Phosphor icon not found: ${name}`);
    return null;
  }
  return <IconComponent {...props} />;
}
