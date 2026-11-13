export interface Candidate {
  resume_id: string;
  filename?: string | null;
  candidate_name?: string | null;
  role?: string | null;
  top_matched_chunk?: string | null;
  score?: number | null;
  full_resume?: string | null;
  s3_key?: string | null;
  pdf_url?: string | null;
}

export interface ResumeItem {
  id?: string;
  resume_id: string;
  filename?: string | null;
  name?: string | null;
  role?: string | null;
  s3_key?: string | null;
  pdf_url?: string | null;
  uploaded_at?: string | null;
}

export interface DocumentItem {
  id: string;
  resume_id: string;
  name?: string | null;
  role?: string | null;
  filename?: string | null;
  s3_key?: string | null;
  pdf_url?: string | null;
  uploaded_at?: string | null;
}

export interface ResumeListResponse {
  resumes: ResumeItem[];
}

export interface ChatRequest {
  query?: string;
  message?: string;
  resume_ids?: string[] | null;
  limit?: number | null;
  generate?: boolean;
}

export type QueryRequest = ChatRequest;

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

export interface UploadFileResult {
  id: number;
  filename: string;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  file_id?: string;
  s3_key?: string;
  error?: {
    error_code?: number | string;
    error_message?: string;
  } | null;
}

export interface UploadResponse {
  'total documents': number;
  'successful uploads': number;
  'failed uploads': number;
  result: UploadFileResult[];
}

export interface ChatState {
  messages: Message[];
  availableResumes: ResumeItem[];
  selectedResumeIds: string[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  error: string | null;
  theme: 'light' | 'dark';
}
