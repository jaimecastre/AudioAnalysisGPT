import { MantineProvider, Title, Text } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { AppLayout } from './components/AppLayout';
import { theme } from './theme';

function App() {
  return (
    <MantineProvider theme={theme}>
      <ModalsProvider>
        <Notifications position="top-right" />
        <AppLayout>
          <div style={{ textAlign: 'center' }}>
            <Title order={1} mb="md">Welcome to AcousticCanvas</Title>
            <Text size="lg" c="dimmed">Professional audio analysis workspace</Text>
          </div>
        </AppLayout>
      </ModalsProvider>
    </MantineProvider>
  );
}

export default App;
