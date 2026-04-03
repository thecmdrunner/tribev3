"use client";

import { useCallback, useState, useRef } from "react";

interface VideoUploadProps {
  onUploadStart: (filename: string, size: number) => void;
  onUploadComplete: (job: {
    id: string;
    filename: string;
    size: number;
  }) => void;
  onUploadError: (error: string) => void;
  disabled?: boolean;
}

const ACCEPTED = ".mp4,.mov,.avi,.mkv,.webm";

export default function VideoUpload({
  onUploadStart,
  onUploadComplete,
  onUploadError,
  disabled,
}: VideoUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setProgress(0);
      onUploadStart(file.name, file.size);

      try {
        const formData = new FormData();
        formData.append("video", file);

        const xhr = new XMLHttpRequest();

        const result = await new Promise<{
          id: string;
          filename: string;
          size: number;
        }>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              const body = JSON.parse(xhr.responseText);
              reject(new Error(body.error || `Upload failed (${xhr.status})`));
            }
          });

          xhr.addEventListener("error", () => reject(new Error("Network error")));
          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });

        onUploadComplete(result);
      } catch (err) {
        onUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        setProgress(0);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onUploadStart, onUploadComplete, onUploadError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && !disabled && inputRef.current?.click()}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed p-12
        text-center transition-all duration-200
        ${
          isDragging
            ? "border-indigo-400 bg-indigo-500/10"
            : "border-neutral-700 hover:border-neutral-500 hover:bg-neutral-900/50"
        }
        ${uploading || disabled ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={handleChange}
        className="hidden"
      />

      {uploading ? (
        <div className="space-y-4">
          <div className="text-lg font-medium text-neutral-300">
            Uploading...
          </div>
          <div className="mx-auto h-2 w-64 max-w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-sm text-neutral-500">{progress}%</div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-4xl">🧠</div>
          <div className="text-lg font-medium text-neutral-300">
            Drop a video here, or click to browse
          </div>
          <div className="text-sm text-neutral-500">
            MP4, MOV, AVI, MKV, WebM &middot; up to 500 MB
          </div>
        </div>
      )}
    </div>
  );
}
