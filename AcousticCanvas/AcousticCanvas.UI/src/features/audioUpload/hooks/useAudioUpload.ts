import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { apiClient, ApiError, HttpMethod } from '../../../shared/api/apiClient';
import { API_ENDPOINTS } from '../../../shared/api/apiEndpoints';
import { useAppDispatch } from '../../../store/reduxHooks';
import { addAudioFile } from '../../project/store/projectSlice';
import type { AudioFileResponse } from '../services/audioUploadApi';

interface UseAudioUploadReturn {
  isUploading: boolean;
  uploadFile: (file: File) => Promise<AudioFileResponse | null>;
  uploadFiles: (files: File[]) => Promise<AudioFileResponse[]>;
}

export const useAudioUpload = (): UseAudioUploadReturn => {
  const dispatch = useAppDispatch();
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = useCallback(async (file: File): Promise<AudioFileResponse | null> => {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const data = await apiClient.requestJson<AudioFileResponse>(
        API_ENDPOINTS.AUDIO.UPLOAD,
        {
          method: HttpMethod.POST,
          body: formData,
        },
      );

      // Dispatch to Redux store for persistence across navigation
      dispatch(addAudioFile({
        id: data.id,
        name: data.name,
        durationSeconds: data.durationSeconds,
        sampleRate: data.sampleRate,
        channels: data.channels,
        bitDepth: data.bitDepth,
        fileSizeBytes: 0,
      }));

      notifications.show({
        title: 'Upload successful',
        message: `Loaded "${data.name}" (${data.durationSeconds.toFixed(2)}s, ${data.sampleRate}Hz)`,
        color: 'teal',
      });

      return data;
    } catch (error) {
      const errorMessage = error instanceof ApiError
        ? `${error.status}: ${error.statusText}`
        : error instanceof Error
          ? error.message
          : 'Unknown error';
      notifications.show({
        title: 'Upload failed',
        message: errorMessage,
        color: 'red',
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [dispatch]);

  const uploadFiles = useCallback(async (files: File[]): Promise<AudioFileResponse[]> => {
    if (files.length === 1) {
      const result = await uploadFile(files[0]!);
      return result ? [result] : [];
    }

    setIsUploading(true);
    const results: AudioFileResponse[] = [];
    let failCount = 0;

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const data = await apiClient.requestJson<AudioFileResponse>(
          API_ENDPOINTS.AUDIO.UPLOAD,
          { method: HttpMethod.POST, body: formData },
        );

        dispatch(addAudioFile({
          id: data.id,
          name: data.name,
          durationSeconds: data.durationSeconds,
          sampleRate: data.sampleRate,
          channels: data.channels,
          bitDepth: data.bitDepth,
          fileSizeBytes: 0,
        }));

        results.push(data);
      } catch {
        failCount++;
      }
    }

    setIsUploading(false);

    if (failCount === 0) {
      notifications.show({
        title: 'Import complete',
        message: `${results.length} file${results.length !== 1 ? 's' : ''} imported successfully`,
        color: 'teal',
      });
    } else {
      notifications.show({
        title: 'Import finished with errors',
        message: `${results.length} succeeded, ${failCount} failed`,
        color: failCount === files.length ? 'red' : 'yellow',
      });
    }

    return results;
  }, [dispatch, uploadFile]);

  return {
    isUploading,
    uploadFile,
    uploadFiles,
  };
};
