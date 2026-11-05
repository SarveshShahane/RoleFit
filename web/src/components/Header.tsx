import React from 'react';
import { RefreshCw, Users, Sun, Moon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearChat, toggleTheme } from '../store/chatSlice';
import { RoleFitLogo } from './RoleFitLogo';

interface HeaderProps {
  onOpenSelector: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSelector }) => {
  const dispatch = useAppDispatch();
  const availableResumes = useAppSelector((state) => state.chat.availableResumes);
  const selectedResumeIds = useAppSelector((state) => state.chat.selectedResumeIds);
  const theme = useAppSelector((state) => state.chat.theme);

  const selectedCount = selectedResumeIds.length;
  const totalCount = availableResumes.length;

  return (
    <header className="sticky top-0 z-30 w-full bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-slate-100 dark:border-zinc-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        <RoleFitLogo />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">RoleFit ATS</h1>
            <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-zinc-900 dark:text-emerald-400 dark:border-zinc-800">
              Agentic RAG
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Intelligent candidate retrieval, semantic ranking & deep resume analysis
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSelector}
          className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 transition shadow-2xs cursor-pointer"
          title="Filter candidates"
        >
          <Users className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
          <span>
            {selectedCount > 0 ? (
              <span className="font-semibold text-slate-900 dark:text-white">
                {selectedCount} of {totalCount} Resumes
              </span>
            ) : (
              <span>All Resumes ({totalCount})</span>
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => dispatch(toggleTheme())}
          className="p-2 text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => dispatch(clearChat())}
          className="p-2 text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          title="Reset conversation"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
