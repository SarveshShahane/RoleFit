export interface Candidate {
  resume_id: string;
  filename?: string | null;
  candidate_name?: string | null;
  role?: string | null;
  top_matched_chunk?: string | null;
  score?: number | null;
  full_resume?: string | null;
}

export interface ResumeItem {
  resume_id: string;
  filename?: string | null;
  name?: string | null;
  role?: string | null;
}

export interface ResumeListResponse {
  resumes: ResumeItem[];
}

export interface QueryRequest {
  query?: string;
  message?: string;
  resume_ids?: string[] | null;
  limit?: number | null;
  generate?: boolean;
}

export interface QueryResponse {
  query: string;
  rewritten_query?: string | null;
  intent: string;
  total_candidates: number;
  candidates: Candidate[];
  answer?: string | null;
  message?: string | null;
}

export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  candidates?: Candidate[];
  scopedResumeIds?: string[];
  isStreaming?: boolean;
  intent?: string;
}

export interface StreamMetadataPayload {
  type: 'metadata';
  candidates: Candidate[];
  query: string;
  intent: string;
}

export interface StreamTokenPayload {
  type: 'token';
  content: string;
}

export interface StreamDonePayload {
  type: 'done';
}

export type StreamEvent = StreamMetadataPayload | StreamTokenPayload | StreamDonePayload;

export interface ChatState {
  messages: Message[];
  availableResumes: ResumeItem[];
  selectedResumeIds: string[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  error: string | null;
}

