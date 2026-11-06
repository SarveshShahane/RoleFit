import axios from 'axios';
import type { ChatRequest, ResumeListResponse, DocumentItem, StreamEvent } from '../types';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

export const resumeService = {
  getDocuments: async (): Promise<DocumentItem[]> => {
    const response = await apiClient.get<DocumentItem[]>('/api/documents');
    return response.data;
  },

  getResumes: async (): Promise<ResumeListResponse> => {
    const response = await apiClient.get<ResumeListResponse>('/api/resumes');
    return response.data;
  },
};

export interface StreamCallbacks {
  onMetadata?: (data: { candidates: any[]; query: string; intent: string }) => void;
  onToken?: (token: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export async function streamChatQuery(
  payload: ChatRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const url = `${API_BASE_URL}/api/chat`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Streaming response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const jsonStr = trimmed.replace(/^data:\s*/, '');
        try {
          const event: StreamEvent = JSON.parse(jsonStr);

          if (event.type === 'metadata' && callbacks.onMetadata) {
            callbacks.onMetadata({
              candidates: event.candidates,
              query: event.query,
              intent: event.intent,
            });
          } else if (event.type === 'token' && callbacks.onToken) {
            callbacks.onToken(event.content);
          } else if (event.type === 'done' && callbacks.onDone) {
            callbacks.onDone();
          }
        } catch {
        }
      }
    }

    if (buffer.trim().startsWith('data:')) {
      try {
        const jsonStr = buffer.trim().replace(/^data:\s*/, '');
        const event: StreamEvent = JSON.parse(jsonStr);
        if (event.type === 'token' && callbacks.onToken) {
          callbacks.onToken(event.content);
        } else if (event.type === 'done' && callbacks.onDone) {
          callbacks.onDone();
        }
      } catch {
      }
    }

    if (callbacks.onDone) {
      callbacks.onDone();
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return;
    if (callbacks.onError) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    } else {
      throw err;
    }
  }
}
