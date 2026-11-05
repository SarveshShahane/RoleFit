import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Candidate, ChatState, Message, ResumeItem } from '../types';

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  }
  return 'light';
};

const initialTheme = getInitialTheme();
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('dark', initialTheme === 'dark');
}

const initialState: ChatState = {
  messages: [
    {
      id: 'welcome-msg',
      sender: 'assistant',
      content:
        '👋 Welcome to **RoleFit ATS**!\n\nI can help you search, evaluate, and rank resumes using AI-powered hybrid retrieval.\n\n* **Search**: "Find candidates with 3+ years in Python, FastAPI, and Qdrant"\n* **Filter**: Click the **target icon (◎)** in the input bar to scope queries to specific candidates.\n* **Compare**: "Compare Chetan and Anudeep for a Senior Backend role"',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ],
  availableResumes: [],
  selectedResumeIds: [],
  isLoading: false,
  isStreaming: false,
  streamingMessageId: null,
  error: null,
  theme: initialTheme,
};

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
      if (action.payload.isStreaming) {
        state.isStreaming = true;
        state.streamingMessageId = action.payload.id;
      }
    },

    appendStreamToken: (state, action: PayloadAction<{ id: string; token: string }>) => {
      const msg = state.messages.find((m) => m.id === action.payload.id);
      if (msg) {
        msg.content = (msg.content || '') + action.payload.token;
      }
    },

    setStreamMetadata: (
      state,
      action: PayloadAction<{ id: string; candidates: Candidate[]; intent?: string }>
    ) => {
      const msg = state.messages.find((m) => m.id === action.payload.id);
      if (msg) {
        msg.candidates = action.payload.candidates;
        if (action.payload.intent) {
          msg.intent = action.payload.intent;
        }
      }
    },

    finalizeStream: (state, action: PayloadAction<string | undefined>) => {
      state.isStreaming = false;
      const targetId = action.payload || state.streamingMessageId;
      if (targetId) {
        const msg = state.messages.find((m) => m.id === targetId);
        if (msg) {
          msg.isStreaming = false;
        }
      }
      state.streamingMessageId = null;
    },

    setAvailableResumes: (state, action: PayloadAction<ResumeItem[]>) => {
      state.availableResumes = action.payload;
    },

    setSelectedResumeIds: (state, action: PayloadAction<string[]>) => {
      state.selectedResumeIds = action.payload;
    },

    toggleResumeId: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const index = state.selectedResumeIds.indexOf(id);
      if (index >= 0) {
        state.selectedResumeIds.splice(index, 1);
      } else {
        state.selectedResumeIds.push(id);
      }
    },

    selectAllResumes: (state) => {
      state.selectedResumeIds = state.availableResumes.map((r) => r.resume_id);
    },

    clearSelectedResumes: (state) => {
      state.selectedResumeIds = [];
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    clearChat: (state) => {
      state.messages = [];
      state.error = null;
      state.isStreaming = false;
      state.streamingMessageId = null;
    },

    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', state.theme);
        document.documentElement.classList.toggle('dark', state.theme === 'dark');
      }
    },

    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', state.theme);
        document.documentElement.classList.toggle('dark', state.theme === 'dark');
      }
    },
  },
});

export const {
  addMessage,
  appendStreamToken,
  setStreamMetadata,
  finalizeStream,
  setAvailableResumes,
  setSelectedResumeIds,
  toggleResumeId,
  selectAllResumes,
  clearSelectedResumes,
  setLoading,
  setError,
  clearChat,
  toggleTheme,
  setTheme,
} = chatSlice.actions;

export default chatSlice.reducer;
