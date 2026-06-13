import type { JSX } from 'react';
import { useState } from 'react';
import { Modal } from '@mantine/core';
import { IconCheck, IconFileMusic } from '@tabler/icons-react';
import type { AudioFile } from '../../../store/projectState';
import { canRunBenchmarkWithSelection } from '../utils/benchmarkSelection';
import styles from './BenchmarkFilePickerModal.module.scss';

interface IBenchmarkFilePickerModalProps {
  opened: boolean;
  onClose: () => void;
  files: AudioFile[];
  initialSelectedIds: Set<string>;
  isLoading: boolean;
  onConfirm: (fileIds: string[]) => void;
}

interface IPickerBodyProps {
  files: AudioFile[];
  initialSelectedIds: Set<string>;
  isLoading: boolean;
  onConfirm: (fileIds: string[]) => void;
}

const PickerBody = ({
  files,
  initialSelectedIds,
  isLoading,
  onConfirm,
}: IPickerBodyProps): JSX.Element => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialSelectedIds));

  const handleToggle = (fileId: string): void => {
    setSelectedIds((previousSelection) => {
      const nextSelection = new Set(previousSelection);
      if (nextSelection.has(fileId)) {
        nextSelection.delete(fileId);
      } else {
        nextSelection.add(fileId);
      }
      return nextSelection;
    });
  };

  const canConfirm = canRunBenchmarkWithSelection(selectedIds) && !isLoading;

  return (
    <>
      <div className={styles.fileList}>
        {files.map((file) => {
          const isSelected = selectedIds.has(file.id);
          return (
            <button
              key={file.id}
              type="button"
              className={`${styles.fileRow} ${isSelected ? styles.fileRowSelected : ''}`}
              onClick={() => handleToggle(file.id)}
            >
              <span className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}>
                {isSelected && <IconCheck size={10} />}
              </span>
              <IconFileMusic size={14} className={styles.fileIcon} />
              <span className={styles.fileName} title={file.name}>{file.name}</span>
              <span className={styles.fileMeta}>
                {file.durationSeconds.toFixed(1)}s · {file.sampleRate / 1000}kHz · {file.channels}ch
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.footer}>
        <span className={styles.footerHint}>
          {selectedIds.size < 2
            ? `Select at least 2 files (${selectedIds.size} selected)`
            : `${selectedIds.size} files selected`}
        </span>
        <button
          type="button"
          className={styles.confirmButton}
          disabled={!canConfirm}
          onClick={() => onConfirm([...selectedIds])}
        >
          {isLoading ? 'Running…' : 'Run benchmark'}
        </button>
      </div>
    </>
  );
};

export const BenchmarkFilePickerModal = ({
  opened,
  onClose,
  files,
  initialSelectedIds,
  isLoading,
  onConfirm,
}: IBenchmarkFilePickerModalProps): JSX.Element => {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Select files to benchmark"
      size="520px"
      centered
      classNames={{
        content: styles.modalContent,
        header: styles.modalHeader,
        title: styles.modalTitle,
        body: styles.modalBody,
        close: styles.modalClose,
      }}
    >
      {opened && (
        <PickerBody
          files={files}
          initialSelectedIds={initialSelectedIds}
          isLoading={isLoading}
          onConfirm={onConfirm}
        />
      )}
    </Modal>
  );
};
