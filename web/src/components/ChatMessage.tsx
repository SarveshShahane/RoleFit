import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  Filter,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import type { Message, ResumeItem } from '../types';

interface ChatMessageProps {
  message: Message;
  availableResumes: ResumeItem[];
}

const CodeBlock: React.FC<{ language?: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-900 dark:bg-black overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-800/90 dark:bg-zinc-900/90 border-b border-slate-700/60 dark:border-zinc-800/80 text-[11px] font-mono text-slate-300 dark:text-zinc-400">
        <span className="font-medium lowercase">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white dark:hover:text-zinc-200 transition cursor-pointer text-[11px]"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-sans">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs font-mono text-slate-100 dark:text-zinc-200 leading-relaxed">
        <code>{value}</code>
      </pre>
    </div>
  );
};

const useTypewriter = (text: string, isStreaming: boolean) => {
  const [displayedText, setDisplayedText] = useState(isStreaming ? '' : text);
  const textRef = useRef(text);
  textRef.current = text;
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedText(text);
      return;
    }

    let rafId: number;

    const step = () => {
      setDisplayedText((prev) => {
        const target = textRef.current;
        if (prev.length >= target.length) return prev;

        const diff = target.length - prev.length;
        let increment = 1;
        if (diff > 80) increment = Math.ceil(diff / 5);
        else if (diff > 30) increment = 4;
        else if (diff > 12) increment = 2;

        return target.slice(0, prev.length + increment);
      });

      if (isStreamingRef.current) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isStreaming]);

  return isStreaming ? displayedText : text;
};

const ChatMessageComponent: React.FC<ChatMessageProps> = ({ message, availableResumes }) => {
  const isUser = message.sender === 'user';
  const [expandedCandidates, setExpandedCandidates] = useState<Record<string, boolean>>({});

  const displayedContent = useTypewriter(message.content, !!message.isStreaming);

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
            <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-medium text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 px-2.5 py-0.5 rounded-full">
              <Filter className="h-3 w-3 text-slate-400 dark:text-zinc-500" />
              <span>Scoped to: {scopedNames.join(', ')}</span>
            </div>
          )}
          <div className="bg-slate-900 dark:bg-zinc-800 text-white dark:text-zinc-100 dark:border dark:border-zinc-700/80 px-5 py-3.5 rounded-2xl rounded-tr-xs shadow-xs text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 px-1">{message.timestamp}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-start mb-8">
      <div className="max-w-[95%] sm:max-w-[88%] md:max-w-[82%] flex gap-3.5 items-start">
        <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex-shrink-0 flex items-center justify-center text-slate-700 dark:text-zinc-300 mt-1">
          <Bot className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">RoleFit Assistant</span>
            {message.intent && message.intent !== 'general' && (
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-mono">
                {message.intent}
              </span>
            )}
            <span className="text-[10px] text-slate-400 dark:text-zinc-500">{message.timestamp}</span>
          </div>

          {message.candidates && message.candidates.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
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
                      className="border border-slate-200 dark:border-zinc-800/90 rounded-xl p-3 bg-white dark:bg-zinc-900/90 hover:border-slate-300 dark:hover:border-zinc-700 transition shadow-2xs text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-zinc-100 text-sm">
                            {cand.candidate_name || `Candidate #${idx + 1}`}
                          </div>
                          <div className="text-slate-500 dark:text-zinc-400 text-[11px] font-medium">
                            {cand.role || 'Applicant'}
                          </div>
                        </div>
                        {scorePercent !== null && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              scorePercent >= 75
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-zinc-800 dark:text-emerald-400 dark:border-zinc-700'
                                : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                            }`}
                          >
                            {scorePercent}% match
                          </span>
                        )}
                      </div>

                      {cand.filename && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-zinc-500 mt-1 truncate">
                          <FileText className="h-2.5 w-2.5 inline" />
                          <span>{cand.filename}</span>
                        </div>
                      )}

                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                        {cand.top_matched_chunk ? (
                          <button
                            type="button"
                            onClick={() => toggleCandidate(cand.resume_id)}
                            className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                <span>Hide snippet</span>
                                <ChevronUp className="h-3 w-3" />
                              </>
                            ) : (
                              <>
                                <span>View snippet</span>
                                <ChevronDown className="h-3 w-3" />
                              </>
                            )}
                          </button>
                        ) : <div />}

                        {cand.pdf_url && (
                          <a
                            href={cand.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-900 dark:text-zinc-100 hover:underline cursor-pointer"
                            title="Open original resume PDF from S3 in a new tab"
                          >
                            <span>View PDF</span>
                            <ExternalLink className="h-3 w-3 inline" />
                          </a>
                        )}
                      </div>

                      {isExpanded && cand.top_matched_chunk && (
                        <div className="mt-1.5 p-2 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-lg text-[11px] text-slate-600 dark:text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                          {cand.top_matched_chunk}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {message.isStreaming && !displayedContent && (
            <div className="flex items-center gap-2 py-2 text-slate-500 dark:text-zinc-400">
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-500 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-500 animate-pulse [animation-delay:200ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-500 animate-pulse [animation-delay:400ms]" />
              </span>
              <span className="text-xs font-medium">Analyzing resumes & generating response...</span>
            </div>
          )}

          {displayedContent && (
            <div
              className={`prose prose-slate dark:prose-invert max-w-none text-sm text-slate-800 dark:text-zinc-200 leading-relaxed break-words ${
                message.isStreaming ? 'streaming-cursor' : ''
              }`}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="pl-0.5">{children}</li>,
                  table: ({ children }) => (
                    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-2xs">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800 text-xs">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-slate-50 dark:bg-zinc-800/70 text-slate-700 dark:text-zinc-200 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-zinc-800">
                      {children}
                    </thead>
                  ),
                  tbody: ({ children }) => (
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 bg-transparent">
                      {children}
                    </tbody>
                  ),
                  tr: ({ children }) => (
                    <tr className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors">
                      {children}
                    </tr>
                  ),
                  th: ({ children }) => (
                    <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-4 py-2.5 text-slate-700 dark:text-zinc-300 align-top leading-relaxed">
                      {children}
                    </td>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-1.5 py-0.5 rounded text-xs font-mono font-medium">
                          {children}
                        </code>
                      );
                    }
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const codeString = String(children).replace(/\n$/, '');
                    return <CodeBlock language={language} value={codeString} />;
                  },
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-slate-300 dark:border-zinc-700 pl-3.5 my-2.5 italic text-slate-600 dark:text-zinc-400 text-xs">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {displayedContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ChatMessage = React.memo(ChatMessageComponent);