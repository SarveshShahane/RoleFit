import React, { useState, useRef, useCallback } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { resumeService } from '../services/api';
import type { UploadFileResult } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

interface StagedFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  errorMessage?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
}) => {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [summaryMessage, setSummaryMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    setGeneralError(null);
    setSummaryMessage(null);
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    const newStaged: StagedFile[] = [];

    Array.from(files).forEach((file) => {
      const lower = file.name.toLowerCase();
      const isValid = validExtensions.some((ext) => lower.endsWith(ext));
      if (!isValid) return;

      newStaged.push({
        file,
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        status: 'pending',
      });
    });

    setStagedFiles((prev) => [...prev, ...newStaged]);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (id: string) => {
    if (isUploading) return;
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    if (isUploading) return;
    setStagedFiles([]);
    setGeneralError(null);
    setSummaryMessage(null);
  };

  const handleUpload = async () => {
    const pendingList = stagedFiles.filter((f) => f.status === 'pending' || f.status === 'failed');
    if (pendingList.length === 0) return;

    setIsUploading(true);
    setGeneralError(null);
    setSummaryMessage(null);

    setStagedFiles((prev) =>
      prev.map((f) =>
        f.status === 'pending' || f.status === 'failed' ? { ...f, status: 'uploading', errorMessage: undefined } : f
      )
    );

    try {
      const filesToSend = pendingList.map((f) => f.file);
      const res = await resumeService.uploadFiles(filesToSend);

      const resultMap = new Map<string, UploadFileResult>();
      (res.result || []).forEach((r) => {
        resultMap.set(r.filename, r);
      });

      setStagedFiles((prev) =>
        prev.map((f) => {
          const match = resultMap.get(f.file.name);
          if (!match) return f;
          if (match.status === 'success') {
            return { ...f, status: 'success', errorMessage: undefined };
          }
          return {
            ...f,
            status: 'failed',
            errorMessage: match.error?.error_message || 'Upload failed',
          };
        })
      );

      const successCount = res['successful uploads'] || 0;
      const failedCount = res['failed uploads'] || 0;
      setSummaryMessage(
        `Uploaded ${successCount} resume${successCount === 1 ? '' : 's'} successfully.${
          failedCount > 0 ? ` (${failedCount} failed)` : ''
        }`
      );

      if (successCount > 0 && onUploadComplete) {
        onUploadComplete();
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Upload failed';
      setGeneralError(msg);
      setStagedFiles((prev) =>
        prev.map((f) => (f.status === 'uploading' ? { ...f, status: 'failed', errorMessage: msg } : f))
      );
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  const totalFiles = stagedFiles.length;
  const pendingCount = stagedFiles.filter((f) => f.status === 'pending' || f.status === 'failed').length;
  const allSuccess = totalFiles > 0 && stagedFiles.every((f) => f.status === 'success');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Upload Resumes</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Add single or multiple candidate resumes to S3 & DynamoDB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-slate-800 bg-slate-50 dark:border-zinc-400 dark:bg-zinc-800/40'
                : 'border-slate-200 dark:border-zinc-700/80 hover:border-slate-400 dark:hover:border-zinc-600 bg-slate-50/50 dark:bg-zinc-950/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  addFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center">
                <UploadCloud className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                Click to browse or drag and drop resumes here
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Supports single or multiple PDF, DOCX, DOC, or TXT files
              </p>
            </div>
          </div>

          {generalError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {summaryMessage && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>{summaryMessage}</span>
            </div>
          )}

          {totalFiles > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 pt-1">
                <span>Selected Resumes ({totalFiles})</span>
                {!isUploading && !allSuccess && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/80 border border-slate-100 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950">
                {stagedFiles.map((staged) => (
                  <div
                    key={staged.id}
                    className="px-3 py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <FileText className="h-4 w-4 text-slate-400 dark:text-zinc-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800 dark:text-zinc-200 truncate">
                          {staged.file.name}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                          {formatFileSize(staged.file.size)}
                        </p>
                        {staged.errorMessage && (
                          <p className="text-[11px] text-red-600 dark:text-red-400 truncate">
                            {staged.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {staged.status === 'uploading' && (
                        <Loader2 className="h-4 w-4 text-slate-600 dark:text-zinc-400 animate-spin" />
                      )}
                      {staged.status === 'success' && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                      {staged.status === 'failed' && (
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                      {staged.status === 'pending' && !isUploading && (
                        <button
                          type="button"
                          onClick={() => removeFile(staged.id)}
                          className="p-1 text-slate-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 transition cursor-pointer"
                          title="Remove file"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
          >
            {allSuccess ? 'Done' : 'Cancel'}
          </button>

          {!allSuccess && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || pendingCount === 0}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white rounded-xl transition cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>
                    Upload {pendingCount > 0 ? `${pendingCount} Resume${pendingCount > 1 ? 's' : ''}` : 'Resumes'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
