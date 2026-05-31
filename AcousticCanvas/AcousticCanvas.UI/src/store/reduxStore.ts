import { configureStore } from '@reduxjs/toolkit';
import navigationReducer from '../features/navigation/navigationSlice';
import projectReducer from '../features/project/projectSlice';
import waveformSelectionReducer from '../features/waveform/waveformSelectionSlice';

export const store = configureStore({
  reducer: {
    navigation: navigationReducer,
    project: projectReducer,
    waveformSelection: waveformSelectionReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
