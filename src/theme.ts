import { createContext, useContext } from 'react';

export const LIGHT = {
  bg: '#fcfcfb',
  paper: '#fffdf8', // writing box
  text: '#0b0b0b',
  muted: '#52514e',
  border: '#c3c2b7',
  hairline: '#e4e3df',
  empty: '#f2f1ee', // progress tile without attempts
  accent: '#2a78d6', // also chart series 1 (correctness)
  accentRgb: '42,120,214',
  accentSoft: '#eaf2fc',
  series2: '#eb6834', // chart series 2 (precision)
  red: '#e34948',
  onAccent: '#ffffff',
  guide: '#9a9993', // hint / show overlays
};
export type Colors = typeof LIGHT;

export const DARK: Colors = {
  bg: '#1a1a19',
  paper: '#232320',
  text: '#f0efec',
  muted: '#c3c2b7',
  border: '#5c5b56',
  hairline: '#33332f',
  empty: '#2a2a27',
  accent: '#3987e5',
  accentRgb: '57,135,229',
  accentSoft: '#1d3352',
  series2: '#d95926',
  red: '#e66767',
  onAccent: '#ffffff',
  guide: '#8f8e88',
};

export const ThemeContext = createContext(LIGHT);
export const useColors = () => useContext(ThemeContext);
