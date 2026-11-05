import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Square, X, Users } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { toggleResumeId, clearSelectedResumes } from '../store/chatSlice';

interface ChatInputProps {
  onSendMessage: (query: string) => void;
  onOpenSelector: () => void;
  onStopStreaming?: () => void;
  isStreaming: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onOpenSelector,
  onStopStreaming,
  isStreaming,
}) => {
  const dispatch = useAppDispatch();
  const availableResumes = useAppSelector((state) => state.chat.availableResumes);
  const selectedResumeIds = useAppSelector((state) => state.chat.selectedResumeIds);

  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const selectedResumes = availableResumes.filter((r) =>
    selectedResumeIds.includes(r.resume_id)
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      {selectedResumes.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl text-xs transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mr-1 flex items-center gap-1">
            <Users className="h-3 w-3" />
            Active Scope ({selectedResumes.length}):
          </span>
          {selectedResumes.map((r) => (
            <span
              key={r.resume_id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 text-xs shadow-2xs font-medium"
            >
              <span>{r.name || r.filename || 'Candidate'}</span>
              <button
                type="button"
                onClick={() => dispatch(toggleResumeId(r.resume_id))}
                className="text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 transition cursor-pointer"
                title="Remove from scope"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => dispatch(clearSelectedResumes())}
            className="text-[11px] text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 ml-auto font-medium underline cursor-pointer"
          >
            Clear scope
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="relative flex items-center bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-full shadow-sm hover:border-slate-400 dark:hover:border-zinc-600 focus-within:border-slate-800 dark:focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-slate-900/10 dark:focus-within:ring-white/10 transition-all p-1.5 pl-2.5"
      >
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={onOpenSelector}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              selectedResumeIds.length > 0
                ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300'
            }`}
            title="Select candidate resumes to scope query"
            aria-label="Candidate resume selector"
          >
            <span className="text-base font-bold select-none leading-none">◎</span>
          </button>

          {selectedResumeIds.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-zinc-950">
              {selectedResumeIds.length}
            </span>
          )}
        </div>

        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedResumeIds.length > 0
              ? `Ask about the ${selectedResumeIds.length} selected candidate(s)...`
              : "Search candidates, compare profiles, or paste job description..."
          }
          className="flex-1 bg-transparent border-0 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-hidden resize-none max-h-40 leading-normal"
        />

        <div className="flex-shrink-0 pr-1">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStopStreaming}
              className="w-9 h-9 rounded-full bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-zinc-900 flex items-center justify-center transition shadow-xs cursor-pointer"
              title="Stop generating"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow-xs cursor-pointer ${
                input.trim()
                  ? 'bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-zinc-900'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-300 dark:text-zinc-600 cursor-not-allowed'
              }`}
              title="Send message"
            >
              <ArrowUp className="h-5 w-5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </form>

      <div className="mt-1.5 text-center text-[11px] text-slate-400 dark:text-zinc-500">
        Press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[10px] text-slate-600 dark:text-zinc-400">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[10px] text-slate-600 dark:text-zinc-400">Shift+Enter</kbd> for newline
      </div>
    </div>
  );
};
