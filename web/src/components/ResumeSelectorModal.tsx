import React, { useState, useMemo } from 'react';
import { X, Search, Check, FileText, ExternalLink } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  toggleResumeId,
  selectAllResumes,
  clearSelectedResumes,
} from '../store/chatSlice';

interface ResumeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResumeSelectorModal: React.FC<ResumeSelectorModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch();
  const availableResumes = useAppSelector((state) => state.chat.availableResumes);
  const selectedResumeIds = useAppSelector((state) => state.chat.selectedResumeIds);

  const [search, setSearch] = useState('');

  const filteredResumes = useMemo(() => {
    if (!search.trim()) return availableResumes;
    const q = search.toLowerCase();
    return availableResumes.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.role && r.role.toLowerCase().includes(q)) ||
        (r.filename && r.filename.toLowerCase().includes(q))
    );
  }, [availableResumes, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-sm">
              ◎
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Select Candidates to Scope</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Queries will be restricted to selected candidates (or leave all unselected to search entire pool)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name, role, or filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-slate-800 dark:focus:ring-zinc-400"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => dispatch(selectAllResumes())}
              className="px-2.5 py-1.5 font-medium text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => dispatch(clearSelectedResumes())}
              className="px-2.5 py-1.5 font-medium text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 divide-y divide-slate-100 dark:divide-zinc-800/80">
          {filteredResumes.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
              No matching candidate resumes found.
            </div>
          ) : (
            filteredResumes.map((resume) => {
              const isSelected = selectedResumeIds.includes(resume.resume_id);
              return (
                <div
                  key={resume.resume_id}
                  onClick={() => dispatch(toggleResumeId(resume.resume_id))}
                  className={`py-3 px-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition ${
                    isSelected ? 'bg-slate-100/70 dark:bg-zinc-800/80' : 'hover:bg-slate-50 dark:hover:bg-zinc-850/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border transition ${
                        isSelected
                          ? 'bg-slate-900 border-slate-900 dark:bg-zinc-100 dark:border-zinc-100 text-white dark:text-zinc-900'
                          : 'border-slate-300 dark:border-zinc-650 bg-white dark:bg-zinc-800'
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                          {resume.name || 'Candidate'}
                        </span>
                        {resume.role && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium">
                            {resume.role}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-zinc-500 truncate flex items-center gap-1 mt-0.5">
                        <FileText className="h-3 w-3 inline" />
                        <span>{resume.filename || resume.resume_id}</span>
                      </div>
                    </div>
                  </div>

                  {resume.pdf_url && (
                    <a
                      href={resume.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 text-slate-400 hover:text-slate-800 dark:text-zinc-500 dark:hover:text-zinc-200 transition cursor-pointer"
                      title="Open resume PDF from S3 in a new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center justify-between">
          <div className="text-xs text-slate-600 dark:text-zinc-400">
            {selectedResumeIds.length === 0 ? (
              <span className="italic text-slate-400 dark:text-zinc-500">
                No filter applied (all {availableResumes.length} candidates active)
              </span>
            ) : (
              <span className="font-medium text-slate-900 dark:text-zinc-100">
                {selectedResumeIds.length} candidate{selectedResumeIds.length > 1 ? 's' : ''} selected
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-white rounded-xl transition shadow-xs cursor-pointer"
          >
            Apply & Done
          </button>
        </div>
      </div>
    </div>
  );
};
