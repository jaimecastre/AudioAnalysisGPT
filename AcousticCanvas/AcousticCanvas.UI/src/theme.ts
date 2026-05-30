import { createTheme, type MantineColorsTuple } from '@mantine/core';

const blue: MantineColorsTuple = [
  '#e7f5ff',
  '#d0ebff',
  '#bae7ff',
  '#a5d8ff',
  '#91caff',
  '#74c0fc',
  '#4dabf7',
  '#339af0',
  '#228be6',
  '#1c7ed6',
  '#1971c2',
  '#1864ab',
  '#145c9d',
  '#0f4c81',
  '#0a3666',
  '#062a4e',
];

export const theme = createTheme({
  colors: {
    blue,
  },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  primaryColor: 'blue',
  defaultRadius: 'md',
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.25rem',
    xl: '1.5rem',
  },
  components: {
    AppShell: {
      styles: {
        main: {
          backgroundColor: '#f8f9fa',
        },
      },
    },
    Navbar: {
      styles: {
        root: {
          borderRight: '1px solid #e9ecef',
        },
      },
    },
    Header: {
      styles: {
        root: {
          borderBottom: '1px solid #e9ecef',
          backgroundColor: '#ffffff',
        },
      },
    },
  },
});
