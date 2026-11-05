import React, { useEffect, useRef, useState } from 'react';
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
import { AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const messages = useAppSelector((state) => state.chat.messages);
  const availableResumes = useAppSelector((state) => state.chat.availableResumes);
  const selectedResumeIds = useAppSelector((state) => state.chat.selectedResumeIds);
  const isStreaming = useAppSelector((state) => state.chat.isStreaming);
  const error = useAppSelector((state) => state.chat.error);

  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const loadResumes = async () => {
      try {
        const data = await resumeService.getResumes();
        dispatch(setAvailableResumes(data.resumes || []));
      } catch (err: any) {
        console.warn('Could not fetch resumes from backend:', err);
      }
    };
    loadResumes();
  }, [dispatch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (queryText: string) => {
    if (isStreaming) return;

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
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-slate-200">
      <Header onOpenSelector={() => setIsSelectorOpen(true)} />

      {error && (
        <div className="w-full max-w-4xl mx-auto px-4 mt-2">
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => dispatch(setError(null))}
              className="text-red-500 hover:text-red-700 font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 w-full max-w-4xl mx-auto">
        <div className="flex flex-col">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              availableResumes={availableResumes}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="sticky bottom-0 bg-gradient-to-t from-white via-white to-white/80 pt-2 pb-2">
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
      />
    </div>
  );
};

export default App;
