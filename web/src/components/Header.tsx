import React from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearChat } from '../store/chatSlice';
import { RoleFitLogo } from './RoleFitLogo';

interface HeaderProps {
  onOpenSelector: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSelector }) => {
  const dispatch = useAppDispatch();
  const availableResumes = useAppSelector((state) => state.chat.availableResumes);
  const selectedResumeIds = useAppSelector((state) => state.chat.selectedResumeIds);

  const selectedCount = selectedResumeIds.length;
  const totalCount = availableResumes.length;

  return (
    <header className="sticky top-0 z-30 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 sm:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <RoleFitLogo />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-900 tracking-tight">RoleFit ATS</h1>
            <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Agentic RAG
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Intelligent candidate retrieval, semantic ranking & deep resume analysis
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSelector}
          className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs cursor-pointer"
          title="Filter candidates"
        >
          <Users className="h-3.5 w-3.5 text-slate-500" />
          <span>
            {selectedCount > 0 ? (
              <span className="font-semibold text-indigo-600">
                {selectedCount} of {totalCount} Resumes
              </span>
            ) : (
              <span>All Resumes ({totalCount})</span>
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => dispatch(clearChat())}
          className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
          title="Reset conversation"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
