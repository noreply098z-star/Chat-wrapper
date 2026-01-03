export interface SenderStat {
  name: string;
  count: number;
  color: string;
  wordCounts: Record<string, number>;
  reelCount: number;
  attachmentCount: number;
  
  // New Analytics
  avgMessageLength: number;
  avgReplyTimeMinutes: number; // Average time to reply TO this person (how fast they get replies) OR how fast they reply? Usually "how fast THEY reply"
  fastestReplySeconds: number;
  slowestReplyMinutes: number;
  longestStreakMessages: number; // Consecutive messages sent by this user
  emojis: Record<string, number>;
  initiatedConversations: number; // Breaks in silence > 6 hours
  lateNightMessages: number; // 12 AM - 4 AM
  morningMessages: number; // 4 AM - 12 PM
  afternoonMessages: number; // 12 PM - 8 PM
  eveningMessages: number; // 8 PM - 12 AM
}

export interface ChatAnalysisResult {
  fileName: string;
  totalMessages: number;
  senders: SenderStat[];
  hourlyStats: Record<string, number>; // Key: "0" to "23"
  timelineStats: Record<string, number>; // Key: ISO Date "YYYY-MM-DD"
  
  // Global Advanced Analytics
  totalDays: number;
  firstMessageDate: string | null;
  lastMessageDate: string | null;
  longestGapDays: number; // Longest silence
  longestDayStreak: number; // Consecutive days with at least 1 message
  activeDaysPct: number; // % of days with messages between start and end
  busiestDay: { date: string; count: number };
  busiestMonth: string;
  
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

// Internal helper for parsing
export interface RawMessage {
  sender: string;
  timestamp: Date;
  content: string;
  type: 'text' | 'attachment' | 'reel';
}
