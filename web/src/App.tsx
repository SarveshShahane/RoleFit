import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './store/hooks';
import {
  addMessage,
  appendStreamToken,
  setStreamMetadata,
  finalizeStream,
  setAvailableResumes,
  setError,
} from './store/chatSlice';
import { resumeService, streamChatQuery } from './services/api';
import type { Message } from './types';
import { Header } from './components/Header';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { ResumeSelectorModal } from './components/ResumeSelectorModal';
import { UploadModal } from './components/UploadModal';
import { AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const messages = useAppSelector((state) => state.chat.messages);
  const availableResumes = useAppSelector((state) => state.chat.availableResumes);
  const selectedResumeIds = useAppSelector((state) => state.chat.selectedResumeIds);
  const isStreaming = useAppSelector((state) => state.chat.isStreaming);
  const error = useAppSelector((state) => state.chat.error);

  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const mainScrollRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshResumes = useCallback(async () => {
    try {
      const docs = await resumeService.getDocuments();
      dispatch(setAvailableResumes(docs || []));
    } catch {
      try {
        const data = await resumeService.getResumes();
        dispatch(setAvailableResumes(data.resumes || []));
      } catch (fallbackErr) {
        console.warn('Could not fetch resumes from backend:', fallbackErr);
      }
    }
  }, [dispatch]);

  useEffect(() => {
    refreshResumes();
  }, [refreshResumes]);

  const handleScroll = () => {
    if (!mainScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = mainScrollRef.current;
    userScrolledUpRef.current = scrollHeight - (scrollTop + clientHeight) > 120;
  };

  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver(() => {
      if (userScrolledUpRef.current || !mainScrollRef.current) return;
      mainScrollRef.current.scrollTop = mainScrollRef.current.scrollHeight;
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (userScrolledUpRef.current || !mainScrollRef.current) return;
    mainScrollRef.current.scrollTop = mainScrollRef.current.scrollHeight;
  }, [messages]);

  const handleSendMessage = async (queryText: string) => {
    if (isStreaming) return;

    userScrolledUpRef.current = false;
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = mainScrollRef.current.scrollHeight;
    }

    const userMessageId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMessageId,
      sender: 'user',
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      scopedResumeIds: selectedResumeIds.length > 0 ? [...selectedResumeIds] : undefined,
    };
    dispatch(addMessage(userMsg));

    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantMessageId,
      sender: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStreaming: true,
      candidates: [],
    };
    dispatch(addMessage(assistantMsg));
    dispatch(setError(null));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamChatQuery(
        {
          query: queryText,
          resume_ids: selectedResumeIds.length > 0 ? selectedResumeIds : null,
          generate: true,
        },
        {
          onMetadata: (meta) => {
            dispatch(
              setStreamMetadata({
                id: assistantMessageId,
                candidates: meta.candidates,
                intent: meta.intent,
              })
            );
          },
          onToken: (token) => {
            dispatch(
              appendStreamToken({
                id: assistantMessageId,
                token,
              })
            );
          },
          onDone: () => {
            dispatch(finalizeStream(assistantMessageId));
          },
          onError: (err) => {
            dispatch(finalizeStream(assistantMessageId));
            dispatch(setError(err.message));
            dispatch(
              appendStreamToken({
                id: assistantMessageId,
                token: `\n\n> ⚠️ **Error**: Failed to complete response: ${err.message}`,
              })
            );
          },
        },
        controller.signal
      );
    } catch (err: any) {
      dispatch(finalizeStream(assistantMessageId));
      dispatch(setError(err.message));
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    dispatch(finalizeStream());
  };

  return (
    <div className="h-screen w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col overflow-hidden font-sans selection:bg-slate-200 dark:selection:bg-zinc-800 transition-colors">
      <Header
        onOpenSelector={() => setIsSelectorOpen(true)}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      {error && (
        <div className="w-full max-w-4xl mx-auto px-4 mt-2 flex-shrink-0">
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs rounded-xl">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => dispatch(setError(null))}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main
        ref={mainScrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6 w-full max-w-4xl mx-auto"
      >
        <div ref={contentRef} className="flex flex-col">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              availableResumes={availableResumes}
            />
          ))}
        </div>
      </main>

      <footer className="flex-shrink-0 bg-gradient-to-t from-white via-white to-white/80 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950/80 pt-2 pb-2 transition-colors">
        <ChatInput
          onSendMessage={handleSendMessage}
          onOpenSelector={() => setIsSelectorOpen(true)}
          onStopStreaming={handleStopStreaming}
          isStreaming={isStreaming}
        />
      </footer>

      <ResumeSelectorModal
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={refreshResumes}
      />
    </div>
  );
};

export default App;
