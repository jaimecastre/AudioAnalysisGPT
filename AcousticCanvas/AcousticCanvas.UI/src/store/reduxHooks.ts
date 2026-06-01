import { useDispatch, useSelector, useStore, type TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from './reduxStore';
import type { Store } from '@reduxjs/toolkit';

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export const useAppStore: () => Store<RootState> = useStore;
