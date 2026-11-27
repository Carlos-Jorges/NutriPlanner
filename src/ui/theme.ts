// Design tokens. Every colour, size and spacing value used by screens lives
// here; screens never hard code them.
//
// Direction: the inside of a family fridge. Cool liner white, evergreen for
// actions, frost blue for freezers, leaf green for fresh food, amber and
// tomato for anything that needs using. One signature element: masking tape
// labels with the storage date written in marker, like a real freezer bag.

import type { TextStyle } from 'react-native';

export const color = {
  bg: '#F2F5F4',
  card: '#FFFFFF',
  ink: '#16211D',
  inkSoft: '#55625C',
  inkFaint: '#89958F',
  line: '#DCE3E0',
  evergreen: '#1E4D3A',
  evergreenPressed: '#163A2C',
  evergreenSoft: '#E3EEE8',
  frost: '#2D6A8E',
  frostSoft: '#E2EDF4',
  leaf: '#2E7A4E',
  leafSoft: '#E4F2E9',
  amber: '#A86E06',
  amberSoft: '#FBEFD6',
  tomato: '#B4372B',
  tomatoSoft: '#F8E2DE',
  tape: '#EFE2BE',
  tapeEdge: '#D9C795',
  tapeInk: '#2B2A25',
  white: '#FFFFFF',
  scrim: 'rgba(22, 33, 29, 0.55)',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const font = { marker: 'PermanentMarker_400Regular' } as const;

export const maxContentWidth = 640;

export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  callout: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export type Tone = 'neutral' | 'evergreen' | 'frost' | 'leaf' | 'amber' | 'tomato';

export const tones: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: '#E8EDEB', fg: color.inkSoft },
  evergreen: { bg: color.evergreenSoft, fg: color.evergreen },
  frost: { bg: color.frostSoft, fg: color.frost },
  leaf: { bg: color.leafSoft, fg: color.leaf },
  amber: { bg: color.amberSoft, fg: color.amber },
  tomato: { bg: color.tomatoSoft, fg: color.tomato },
};
