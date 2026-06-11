import type { JSX } from 'react';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { AppLayout } from './components/AppLayout';
import { ModeContentPlaceholder } from './features/shell/components/ModeContentPlaceholder';
import { theme } from './theme';

const App = (): JSX.Element => {
  return (
    <MantineProvider theme={theme}>
      <ModalsProvider>
        <Notifications position="top-right" />
        <AppLayout>
          <ModeContentPlaceholder />
        </AppLayout>
      </ModalsProvider>
    </MantineProvider>
  );
};

export default App;
