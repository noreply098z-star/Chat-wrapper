export interface SenderStat {
  name: string;
  count: number;
  color: string;
  wordCounts: Record<string, number>;
  reelCount: number;
  attachmentCount: number;
}

export interface ChatAnalysisResult {
  fileName: string;
  totalMessages: number;
  senders: SenderStat[];
  hourlyStats: Record<string, number>; // Key: "0" to "23"
  timelineStats: Record<string, number>; // Key: ISO Date "YYYY-MM-DD"
  // Metadata is stored but explicitly not displayed as per requirements
  metadata: {
    parsedAt: string;
    rawNodeCount: number;
    detectedFormat: string;
    otherAttributes: Record<string, unknown>;
  };
}

export interface ParseError {
  fileName: string;
  error: string;
}

export type UploadStatus = 'idle' | 'parsing' | 'complete' | 'error';

export interface FileProgress {
  name: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
}
