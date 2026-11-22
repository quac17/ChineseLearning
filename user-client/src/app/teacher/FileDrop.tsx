'use client';

import { useId, useState, type DragEvent } from 'react';
import { formatFileSize } from '@/lib/api';
import s from './teacher.module.css';

interface FileDropProps {
  /** Accessible name of the file input, e.g. "Tệp video". */
  label: string;
  /** ".mp4,.webm" */
  accept: string;
  /** Shown under the title, e.g. ".mp4, .webm, .mov · tối đa 500 MB". */
  hint: string;
  file: File | null;
  onFile: (file: File | null) => void;
}

/** Drag-and-drop zone around a real file input ("Chọn file" opens the picker). */
export function FileDrop({ label, accept, hint, file, onFile }: FileDropProps) {
  const id = useId();
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  };

  return (
    <div
      className={s.drop}
      data-over={over || undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <b>{file ? file.name : 'Kéo thả file vào đây'}</b>
      <span className={s.note}>{file ? formatFileSize(file.size) : hint}</span>
      <input
        // A cleared selection remounts the input so the same file can be picked again.
        key={file ? 'picked' : 'empty'}
        id={id}
        type="file"
        accept={accept}
        aria-label={label}
        className={s.fileInput}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <label htmlFor={id} className={s.fileButton}>
        {file ? 'Chọn file khác' : 'Chọn file'}
      </label>
    </div>
  );
}
