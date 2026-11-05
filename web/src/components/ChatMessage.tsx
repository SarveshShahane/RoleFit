import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, ChevronDown, ChevronUp, FileText, Sparkles, Filter } from 'lucide-react';
import type { Message, ResumeItem } from '../types';

interface ChatMessageProps {
  message: Message;
  availableResumes: ResumeItem[];
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, availableResumes }) => {
  const isUser = message.sender === 'user';
  const [expandedCandidates, setExpandedCandidates] = useState<Record<string, boolean>>({});

  const toggleCandidate = (id: string) => {
    setExpandedCandidates((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const scopedNames = React.useMemo(() => {
    if (!message.scopedResumeIds || message.scopedResumeIds.length === 0) return [];
    return message.scopedResumeIds.map((id) => {
      const match = availableResumes.find((r) => r.resume_id === id);
      return match?.name || id.slice(0, 8);
    });
  }, [message.scopedResumeIds, availableResumes]);

  if (isUser) {
    return (
      <div className="w-full flex justify-end mb-6">
        <div className="max-w-[85%] sm:max-w-[70%] flex flex-col items-end">
          {scopedNames.length > 0 && (
            <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200/80 px-2.5 py-0.5 rounded-full">
              <Filter className="h-3 w-3 text-slate-400" />
              <span>Scoped to: {scopedNames.join(', ')}</span>
            </div>
          )}
          <div className="bg-slate-900 text-white px-5 py-3.5 rounded-2xl rounded-tr-xs shadow-xs text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 px-1">{message.timestamp}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-start mb-8 animate-in fade-in duration-200">
      <div className="max-w-[95%] sm:max-w-[88%] md:max-w-[82%] flex gap-3.5 items-start">
        <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center justify-center text-slate-700 mt-1">
          <Bot className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-slate-900">RoleFit Assistant</span>
            {message.intent && message.intent !== 'general' && (
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
                {message.intent}
              </span>
            )}
            <span className="text-[10px] text-slate-400">{message.timestamp}</span>
          </div>

          {message.candidates && message.candidates.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Top Candidate Matches ({message.candidates.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {message.candidates.map((cand, idx) => {
                  const isExpanded = !!expandedCandidates[cand.resume_id];
                  const scorePercent = cand.score ? Math.round(cand.score * 100) : null;
                  return (
                    <div
                      key={cand.resume_id || idx}
                      className="border border-slate-200 rounded-xl p-3 bg-white hover:border-slate-300 transition shadow-2xs text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">
                            {cand.candidate_name || `Candidate #${idx + 1}`}
                          </div>
                          <div className="text-slate-500 text-[11px] font-medium">
                            {cand.role || 'Applicant'}
                          </div>
                        </div>
                        {scorePercent !== null && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              scorePercent >= 75
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {scorePercent}% match
                          </span>
                        )}
                      </div>

                      {cand.filename && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 truncate">
                          <FileText className="h-2.5 w-2.5 inline" />
                          <span>{cand.filename}</span>
                        </div>
                      )}

                      {cand.top_matched_chunk && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => toggleCandidate(cand.resume_id)}
                            className="text-[11px] font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                <span>Hide matched text</span>
                                <ChevronUp className="h-3 w-3" />
                              </>
                            ) : (
                              <>
                                <span>View matched snippet</span>
                                <ChevronDown className="h-3 w-3" />
                              </>
                            )}
                          </button>
                          {isExpanded && (
                            <div className="mt-1.5 p-2 bg-slate-50 border border-slate-100 rounded-lg text-[11px] text-slate-600 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                              {cand.top_matched_chunk}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="prose prose-slate max-w-none text-sm text-slate-800 leading-relaxed break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="pl-0.5">{children}</li>,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3 border border-slate-200 rounded-lg">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-slate-50 font-semibold text-slate-700">{children}</thead>,
                th: ({ children }) => <th className="px-3 py-2 text-left">{children}</th>,
                td: ({ children }) => <td className="px-3 py-2 border-t border-slate-100">{children}</td>,
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs font-mono font-medium">
                      {children}
                    </code>
                  ) : (
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-xs font-mono my-2">
                      <code>{children}</code>
                    </pre>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>

            {message.isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-slate-900 animate-pulse align-middle" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
