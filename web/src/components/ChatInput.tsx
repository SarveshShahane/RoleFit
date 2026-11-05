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
        <div className="mb-2 flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mr-1 flex items-center gap-1">
            <Users className="h-3 w-3" />
            Active Scope ({selectedResumes.length}):
          </span>
          {selectedResumes.map((r) => (
            <span
              key={r.resume_id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs shadow-2xs font-medium"
            >
              <span>{r.name || r.filename || 'Candidate'}</span>
              <button
                type="button"
                onClick={() => dispatch(toggleResumeId(r.resume_id))}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
                title="Remove from scope"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => dispatch(clearSelectedResumes())}
            className="text-[11px] text-slate-500 hover:text-slate-800 ml-auto font-medium underline cursor-pointer"
          >
            Clear scope
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="relative flex items-center bg-white border border-slate-300 rounded-full shadow-sm hover:border-slate-400 focus-within:border-slate-800 focus-within:ring-2 focus-within:ring-slate-900/10 transition-all p-1.5 pl-2.5"
      >
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={onOpenSelector}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              selectedResumeIds.length > 0
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Select candidate resumes to scope query"
            aria-label="Candidate resume selector"
          >
            <span className="text-base font-bold select-none leading-none">◎</span>
          </button>

          {selectedResumeIds.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
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
          className="flex-1 bg-transparent border-0 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden resize-none max-h-40 leading-normal"
        />

        <div className="flex-shrink-0 pr-1">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStopStreaming}
              className="w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition shadow-xs cursor-pointer"
              title="Stop generating"
            >
              <Square className="h-4 w-4 fill-white" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow-xs cursor-pointer ${
                input.trim()
                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
              title="Send message"
            >
              <ArrowUp className="h-5 w-5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </form>

      <div className="mt-1.5 text-center text-[11px] text-slate-400">
        Press <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">Shift+Enter</kbd> for newline
      </div>
    </div>
  );
};
