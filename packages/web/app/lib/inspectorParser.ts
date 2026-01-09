export interface ParsedTailwindStyles {
  spacing: {
    margin?: Record<string, string>;
    padding?: Record<string, string>;
    gap?: string;
  };
  layout: {
    display?: string;
    flexDirection?: string;
    justifyContent?: string;
    alignItems?: string;
    gridCols?: number | null;
    gridRows?: number | null;
  };
  sizing: {
    width?: string;
    height?: string;
  };
  typography: {
    fontSize?: string;
    fontWeight?: string;
    lineHeight?: string;
    letterSpacing?: string;
  };
  colors: {
    textColor?: string;
    backgroundColor?: string;
    borderColor?: string;
  };
  border: {
    width?: string;
    radius?: string;
  };
  effects: {
    shadow?: string;
  };
  other: string[];
}

const spacingScale: Record<string, string> = {
  'px': '1px',
  '0': '0px',
  '0.5': '0.125rem',
  '1': '0.25rem',
  '1.5': '0.375rem',
  '2': '0.5rem',
  '2.5': '0.625rem',
  '3': '0.75rem',
  '3.5': '0.875rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '7': '1.75rem',
  '8': '2rem',
  '9': '2.25rem',
  '10': '2.5rem',
  '11': '2.75rem',
  '12': '3rem',
  '14': '3.5rem',
  '16': '4rem',
  '20': '5rem',
  '24': '6rem',
  '28': '7rem',
  '32': '8rem',
  '36': '9rem',
  '40': '10rem',
  '44': '11rem',
  '48': '12rem',
  '52': '13rem',
  '56': '14rem',
  '60': '15rem',
  '64': '16rem',
  '72': '18rem',
  '80': '20rem',
  '96': '24rem',
};

const fontSizeMap: Record<string, string> = {
  'xs': '0.75rem',
  'sm': '0.875rem',
  'base': '1rem',
  'lg': '1.125rem',
  'xl': '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  '5xl': '3rem',
  '6xl': '3.75rem',
  '7xl': '4.5rem',
  '8xl': '6rem',
  '9xl': '8rem',
};

function parseSpacing(value: string): string | undefined {
  if (value in spacingScale) return spacingScale[value];
  if (/^\d+\.?\d*rem$/.test(value)) return value;
  return undefined;
}

export function parseTailwindClasses(classList: string[]): ParsedTailwindStyles {
  const parsed: ParsedTailwindStyles = {
    spacing: {},
    layout: {},
    sizing: {},
    typography: {},
    colors: {},
    border: {},
    effects: {},
    other: [],
  };

  for (const cls of classList) {
    // Spacing
    let m;
    if ((m = cls.match(/^p(?:-(\d+\.?\d*|px))$/))) {
      parsed.spacing.padding ||= {};
      parsed.spacing.padding.all = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^px-(\d+\.?\d*|px)$/))) {
      parsed.spacing.padding ||= {};
      parsed.spacing.padding.x = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^py-(\d+\.?\d*|px)$/))) {
      parsed.spacing.padding ||= {};
      parsed.spacing.padding.y = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^pt-(\d+\.?\d*|px)$/))) {
      parsed.spacing.padding ||= {};
      parsed.spacing.padding.top = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^pr-(\d+\.?\d*|px)$/))) {
      parsed.spacing.padding ||= {};
      parsed.spacing.padding.right = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^pb-(\d+\.?\d*|px)$/))) {
      parsed.spacing.padding ||= {};
      parsed.spacing.padding.bottom = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^pl-(\d+\.?\d*|px)$/))) {
      parsed.spacing.padding ||= {};
      parsed.spacing.padding.left = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^m(?:-(\d+\.?\d*|px))$/))) {
      parsed.spacing.margin ||= {};
      parsed.spacing.margin.all = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^mx-(\d+\.?\d*|px)$/))) {
      parsed.spacing.margin ||= {};
      parsed.spacing.margin.x = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^my-(\d+\.?\d*|px)$/))) {
      parsed.spacing.margin ||= {};
      parsed.spacing.margin.y = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^mt-(\d+\.?\d*|px)$/))) {
      parsed.spacing.margin ||= {};
      parsed.spacing.margin.top = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^mr-(\d+\.?\d*|px)$/))) {
      parsed.spacing.margin ||= {};
      parsed.spacing.margin.right = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^mb-(\d+\.?\d*|px)$/))) {
      parsed.spacing.margin ||= {};
      parsed.spacing.margin.bottom = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^ml-(\d+\.?\d*|px)$/))) {
      parsed.spacing.margin ||= {};
      parsed.spacing.margin.left = parseSpacing(m[1]) || m[1];
      continue;
    }
    if ((m = cls.match(/^gap-(\d+\.?\d*|px)$/))) {
      parsed.spacing.gap = parseSpacing(m[1]) || m[1];
      continue;
    }

    // Layout / Flex / Grid
    if (cls === 'flex' || cls === 'inline-flex' || cls === 'block' || cls === 'inline-block' || cls === 'grid' || cls === 'inline-grid') {
      parsed.layout.display = cls;
      continue;
    }
    if (cls === 'flex-row' || cls === 'flex-col') {
      parsed.layout.flexDirection = cls === 'flex-col' ? 'column' : 'row';
      continue;
    }
    if ((m = cls.match(/^items-(start|center|end|baseline|stretch)$/))) {
      parsed.layout.alignItems = m[1];
      continue;
    }
    if ((m = cls.match(/^justify-(start|center|end|between|around|evenly)$/))) {
      const map: Record<string, string> = {
        start: 'flex-start',
        center: 'center',
        end: 'flex-end',
        between: 'space-between',
        around: 'space-around',
        evenly: 'space-evenly',
      };
      parsed.layout.justifyContent = map[m[1]];
      continue;
    }
    if ((m = cls.match(/^grid-cols-(\d+)$/))) {
      parsed.layout.gridCols = parseInt(m[1], 10);
      continue;
    }
    if ((m = cls.match(/^grid-rows-(\d+)$/))) {
      parsed.layout.gridRows = parseInt(m[1], 10);
      continue;
    }

    // Sizing
    if ((m = cls.match(/^w-(\d+|px|full|screen)$/))) {
      const v = m[1];
      parsed.sizing.width = v === 'full' ? '100%' : v === 'screen' ? '100vw' : spacingScale[v] || (v === 'px' ? '1px' : v + ' (tw)');
      continue;
    }
    if ((m = cls.match(/^h-(\d+|px|full|screen)$/))) {
      const v = m[1];
      parsed.sizing.height = v === 'full' ? '100%' : v === 'screen' ? '100vh' : spacingScale[v] || (v === 'px' ? '1px' : v + ' (tw)');
      continue;
    }

    // Typography
    if ((m = cls.match(/^text-(xs|sm|base|lg|xl|[2-9]xl)$/))) {
      parsed.typography.fontSize = fontSizeMap[m[1]] || m[1];
      continue;
    }
    if ((m = cls.match(/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/))) {
      parsed.typography.fontWeight = m[1];
      continue;
    }
    if ((m = cls.match(/^leading-(none|tight|snug|normal|relaxed|loose|\d+)$/))) {
      parsed.typography.lineHeight = m[1];
      continue;
    }
    if ((m = cls.match(/^tracking-(tighter|tight|normal|wide|wider|widest)$/))) {
      parsed.typography.letterSpacing = m[1];
      continue;
    }

    // Colors (basic token display)
    if ((m = cls.match(/^text-([a-z]+(?:-\d{2,3})?)$/))) {
      parsed.colors.textColor = m[1];
      continue;
    }
    // Tailwind arbitrary color values e.g. bg-info-500 or bg-[rgb(0,0,0)]
    if ((m = cls.match(/^bg-\[(.+)\]$/))) {
      parsed.colors.backgroundColor = m[1];
      continue;
    }
    if ((m = cls.match(/^bg-([a-z]+(?:-\d{2,3})?)$/))) {
      parsed.colors.backgroundColor = m[1];
      continue;
    }
    if ((m = cls.match(/^border-\[(.+)\]$/))) {
      parsed.colors.borderColor = m[1];
      continue;
    }
    if ((m = cls.match(/^border-([a-z]+(?:-\d{2,3})?)$/))) {
      parsed.colors.borderColor = m[1];
      continue;
    }

    // Border
    if (cls === 'border') {
      parsed.border.width = '1px';
      continue;
    }
    if ((m = cls.match(/^border-(\d)$/))) {
      parsed.border.width = `${m[1]}px`;
      continue;
    }
    if ((m = cls.match(/^rounded(-(none|sm|md|lg|xl|2xl|3xl|full))?$/))) {
      const map: Record<string, string> = {
        none: '0px',
        sm: '0.125rem',
        '': '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      };
      const key = (m[2] ?? '') as keyof typeof map;
      parsed.border.radius = map[key] ?? '0.25rem';
      continue;
    }

    // Effects
    if (cls.startsWith('shadow')) {
      parsed.effects.shadow = cls;
      continue;
    }

    parsed.other.push(cls);
  }

  return parsed;
}

export function summarizeAttributes(attrs: Record<string, string> | undefined, tagName: string | undefined) {
  const summary: Array<{ name: string; value: string; note?: string }> = [];
  if (!attrs) return summary;

  const add = (name: string, note?: string) => {
    if (attrs[name] != null) summary.push({ name, value: attrs[name], note });
  };

  // Common attributes
  ['id', 'class', 'title', 'style'].forEach((n) => add(n));

  // Links
  if (tagName?.toLowerCase() === 'a') {
    add('href');
    add('target');
    add('rel');
  }
  // Images
  if (tagName?.toLowerCase() === 'img') {
    add('src');
    add('alt');
    add('width');
    add('height');
    add('loading');
  }
  // Input controls
  if (tagName && ['input', 'textarea', 'select'].includes(tagName.toLowerCase())) {
    add('name');
    add('type');
    add('placeholder');
    add('value');
    add('required');
    add('disabled');
  }

  // Data-* attributes
  Object.keys(attrs)
    .filter((k) => k.startsWith('data-'))
    .forEach((k) => summary.push({ name: k, value: attrs[k] }));

  // Aria-* attributes
  Object.keys(attrs)
    .filter((k) => k.startsWith('aria-'))
    .forEach((k) => summary.push({ name: k, value: attrs[k] }));

  // Any others not already included
  Object.keys(attrs)
    .filter(
      (k) =>
        !summary.some((s) => s.name === k) &&
        !k.startsWith('on') // skip event handlers
    )
    .forEach((k) => summary.push({ name: k, value: attrs[k] }));

  return summary;
}


