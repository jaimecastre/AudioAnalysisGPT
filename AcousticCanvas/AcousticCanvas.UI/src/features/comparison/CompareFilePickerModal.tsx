import type { JSX } from 'react';
import { useState } from 'react';
import { Modal } from '@mantine/core';
import { IconFileMusic, IconCheck } from '@tabler/icons-react';
import type { AudioFile } from '../../store/projectState';
import styles from './CompareFilePickerModal.module.scss';

interface CompareFilePickerModalProps {
  opened: boolean;
  onClose: () => void;
  files: AudioFile[];
  initialSelectedIds: Set<string>;
  onConfirm: (fileIds: string[]) => void;
  isLoading: boolean;
}

interface PickerBodyProps {
  files: AudioFile[];
  initialSelectedIds: Set<string>;
  onConfirm: (fileIds: string[]) => void;
  isLoading: boolean;
}

function PickerBody({ files, initialSelectedIds, onConfirm, isLoading }: PickerBodyProps): JSX.Element {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialSelectedIds));

  const handleToggle = (fileId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const canConfirm = selectedIds.size >= 2 && !isLoading;

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
                {(file.durationSeconds).toFixed(1)}s · {file.sampleRate / 1000}kHz · {file.channels}ch
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
          {isLoading ? 'Comparing…' : 'Compare'}
        </button>
      </div>
    </>
  );
}

export function CompareFilePickerModal({
  opened,
  onClose,
  files,
  initialSelectedIds,
  onConfirm,
  isLoading,
}: CompareFilePickerModalProps): JSX.Element {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Select files to compare"
      size="480px"
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
          onConfirm={onConfirm}
          isLoading={isLoading}
        />
      )}
    </Modal>
  );
}
