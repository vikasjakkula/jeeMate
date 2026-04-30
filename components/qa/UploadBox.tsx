"use client";

import * as React from "react";

export type UploadedFileItem = {
  id: string;
  file: File;
  progress: number; // 0..100
};

type UploadBoxProps = {
  items: UploadedFileItem[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
};

function formatPercent(n: number) {
  const clamped = Math.max(0, Math.min(100, n));
  return `${Math.round(clamped)}%`;
}

export function UploadBox({ items, onAddFiles, onRemove }: UploadBoxProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  function onBrowse() {
    inputRef.current?.click();
  }

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length) onAddFiles(files);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      onAddFiles(e.dataTransfer.files);
    }
  }

  return (
    <div className="uploadShell">
      <div
        className={`uploadDrop ${isDragOver ? "uploadDrop--active" : ""}`}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
        }}
        onDrop={onDrop}
      >
        <div className="uploadIcon">↑</div>
        <button type="button" className="uploadBrowse" onClick={onBrowse}>
          Browse
        </button>
        <div className="uploadHint">drop a file here</div>
        <div className="uploadSupport">
          <span className="uploadSupportStar">*</span>File supported .png , .jpg &
          .webp
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="uploadInput"
          onChange={onFilesSelected}
        />
      </div>

      <div className="uploadList">
        <div className="uploadListTitle">Uploaded files</div>
        <div className="uploadItems">
          {items.length === 0 ? (
            <div className="uploadEmpty">No files yet.</div>
          ) : (
            items.map((it) => (
              <div key={it.id} className="uploadItem">
                <div className="uploadItemLeft">
                  <div className="uploadFileIcon">🖼️</div>
                  <div className="uploadFileName">{it.file.name}</div>
                </div>

                <div className="uploadItemRight">
                  <div className="uploadProgress">
                    <div
                      className="uploadProgressBar"
                      style={{ width: `${Math.max(0, Math.min(100, it.progress))}%` }}
                    />
                  </div>
                  <div className="uploadProgressText">{formatPercent(it.progress)}</div>
                  <button
                    type="button"
                    className="uploadDelete"
                    onClick={() => onRemove(it.id)}
                    aria-label="Remove file"
                    title="Remove file"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

