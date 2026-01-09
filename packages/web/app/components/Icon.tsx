import * as PhosphorIcons from 'phosphor-react';
import React from 'react';

// Type for all available Phosphor icons
export type PhosphorIconName = keyof typeof PhosphorIcons | string;

// Icon size presets (in pixels)
const ICON_SIZES = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
  '2xl': 64,
} as const;

type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
type IconSize = typeof ICON_SIZES[keyof typeof ICON_SIZES];

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  /**
   * Name of the Phosphor icon
   * @example "House", "Gear", "MagnifyingGlass"
   */
  name: PhosphorIconName;

  /**
   * Size of the icon
   * @default "md" (24px)
   */
  size?: IconSize | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

  /**
   * Weight/style of the icon
   * @default "regular"
   */
  weight?: IconWeight;

  /**
   * Whether this icon is in active/selected state
   * If true, uses duotone weight and primary color
   * @default false
   */
  isActive?: boolean;

  /**
   * Color of the icon
   * @default "currentColor"
   */
  color?: string;

  /**
   * CSS class name
   */
  className?: string;
}

/**
 * Icon Component - Wrapper around Phosphor React Icons
 *
 * Provides a consistent icon system with support for:
 * - Multiple sizes (xs, sm, md, lg, xl, 2xl)
 * - Multiple weights (thin, light, regular, bold, fill, duotone)
 * - Active state styling
 * - Color customization
 *
 * @example
 * // Default icon
 * <Icon name="House" />
 *
 * // With size and weight
 * <Icon name="House" size="lg" weight="bold" />
 *
 * // Active state with duotone weight
 * <Icon name="House" isActive={true} />
 *
 * // Custom color
 * <Icon name="House" color="#3366FF" />
 */
export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  (
    {
      name,
      size = 'md',
      weight = 'regular',
      isActive = false,
      color = 'currentColor',
      className = '',
      ...props
    },
    ref
  ) => {
    // Get icon component
    const IconComponent = (PhosphorIcons as any)[name] as React.FC<any> | undefined;

    if (!IconComponent) {
      console.warn(`Icon "${name}" not found in Phosphor Icons`);
      return null;
    }

    // Resolve size
    const sizeValue =
      typeof size === 'string'
        ? ICON_SIZES[size as keyof typeof ICON_SIZES] || 24
        : size;

    // Determine weight - use duotone if active
    const resolvedWeight = isActive ? 'duotone' : weight;

    // Use primary color if active, otherwise use provided color
    const resolvedColor = isActive ? '#3366FF' : color;

    return (
      <IconComponent
        ref={ref}
        size={sizeValue}
        weight={resolvedWeight}
        color={resolvedColor}
        className={className}
        {...props}
      />
    );
  }
);

Icon.displayName = 'Icon';

/**
 * Common icon component presets
 */

export const Icons = {
  /**
   * Navigation Icons
   */
  Home: (props: Omit<IconProps, 'name'>) => <Icon name="House" {...props} />,
  Dashboard: (props: Omit<IconProps, 'name'>) => (
    <Icon name="SquaresFour" {...props} />
  ),
  Menu: (props: Omit<IconProps, 'name'>) => <Icon name="List" {...props} />,
  Settings: (props: Omit<IconProps, 'name'>) => <Icon name="Gear" {...props} />,
  Search: (props: Omit<IconProps, 'name'>) => (
    <Icon name="MagnifyingGlass" {...props} />
  ),
  Close: (props: Omit<IconProps, 'name'>) => <Icon name="X" {...props} />,
  Back: (props: Omit<IconProps, 'name'>) => (
    <Icon name="CaretLeft" {...props} />
  ),
  Next: (props: Omit<IconProps, 'name'>) => (
    <Icon name="CaretRight" {...props} />
  ),

  /**
   * File & Document Icons
   */
  File: (props: Omit<IconProps, 'name'>) => <Icon name="File" {...props} />,
  Folder: (props: Omit<IconProps, 'name'>) => <Icon name="Folder" {...props} />,
  Document: (props: Omit<IconProps, 'name'>) => (
    <Icon name="FileText" {...props} />
  ),
  Code: (props: Omit<IconProps, 'name'>) => <Icon name="Code" {...props} />,
  Download: (props: Omit<IconProps, 'name'>) => (
    <Icon name="Download" {...props} />
  ),
  Upload: (props: Omit<IconProps, 'name'>) => (
    <Icon name="Upload" {...props} />
  ),

  /**
   * Action Icons
   */
  Edit: (props: Omit<IconProps, 'name'>) => <Icon name="PencilSimple" {...props} />,
  Delete: (props: Omit<IconProps, 'name'>) => <Icon name="Trash" {...props} />,
  Copy: (props: Omit<IconProps, 'name'>) => (
    <Icon name="CopySimple" {...props} />
  ),
  Save: (props: Omit<IconProps, 'name'>) => <Icon name="FloppyDisk" {...props} />,
  Plus: (props: Omit<IconProps, 'name'>) => <Icon name="Plus" {...props} />,
  Minus: (props: Omit<IconProps, 'name'>) => <Icon name="Minus" {...props} />,
  Refresh: (props: Omit<IconProps, 'name'>) => (
    <Icon name="ArrowsClockwise" {...props} />
  ),

  /**
   * Communication Icons
   */
  Chat: (props: Omit<IconProps, 'name'>) => (
    <Icon name="ChatCircle" {...props} />
  ),
  Mail: (props: Omit<IconProps, 'name'>) => <Icon name="Envelope" {...props} />,
  Bell: (props: Omit<IconProps, 'name'>) => <Icon name="Bell" {...props} />,
  Phone: (props: Omit<IconProps, 'name'>) => <Icon name="Phone" {...props} />,

  /**
   * Status Icons
   */
  Check: (props: Omit<IconProps, 'name'>) => <Icon name="Check" {...props} />,
  CheckCircle: (props: Omit<IconProps, 'name'>) => (
    <Icon name="CheckCircle" {...props} />
  ),
  Warning: (props: Omit<IconProps, 'name'>) => (
    <Icon name="Warning" {...props} />
  ),
  Error: (props: Omit<IconProps, 'name'>) => (
    <Icon name="XCircle" {...props} />
  ),
  Info: (props: Omit<IconProps, 'name'>) => (
    <Icon name="Info" {...props} />
  ),
  Loading: (props: Omit<IconProps, 'name'>) => (
    <Icon name="Spinner" {...props} />
  ),

  /**
   * Social Icons
   */
  GitHub: (props: Omit<IconProps, 'name'>) => (
    <Icon name="GithubLogo" {...props} />
  ),
  Twitter: (props: Omit<IconProps, 'name'>) => (
    <Icon name="TwitterLogo" {...props} />
  ),
  LinkedIn: (props: Omit<IconProps, 'name'>) => (
    <Icon name="LinkedinLogo" {...props} />
  ),

  /**
   * Utility Icons
   */
  Clock: (props: Omit<IconProps, 'name'>) => <Icon name="Clock" {...props} />,
  Calendar: (props: Omit<IconProps, 'name'>) => (
    <Icon name="Calendar" {...props} />
  ),
  Link: (props: Omit<IconProps, 'name'>) => <Icon name="Link" {...props} />,
  Eye: (props: Omit<IconProps, 'name'>) => <Icon name="Eye" {...props} />,
  EyeSlash: (props: Omit<IconProps, 'name'>) => (
    <Icon name="EyeSlash" {...props} />
  ),
  Lock: (props: Omit<IconProps, 'name'>) => <Icon name="Lock" {...props} />,
  Unlock: (props: Omit<IconProps, 'name'>) => (
    <Icon name="Unlock" {...props} />
  ),
  User: (props: Omit<IconProps, 'name'>) => <Icon name="User" {...props} />,
  Users: (props: Omit<IconProps, 'name'>) => <Icon name="Users" {...props} />,
  Star: (props: Omit<IconProps, 'name'>) => <Icon name="Star" {...props} />,
  Heart: (props: Omit<IconProps, 'name'>) => <Icon name="Heart" {...props} />,
};

export default Icon;
