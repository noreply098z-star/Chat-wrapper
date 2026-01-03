import { ChatAnalysisResult, SenderStat, RawMessage } from '../types';

const COLORS = [
  '#4F46E5', '#EC4899', '#10B981', '#F59E0B', 
  '#6366F1', '#8B5CF6', '#EF4444', '#3B82F6'
];

const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'are', 'was', 'were', 'had', 'has', 'sent', 'attachment', 'message', 'chat', 'pm', 'am', 'om', 'ok', 'okay', 'lol', 'yeah', 'yes', 'no', 'attachment.', 'you', 'to'
]);

// Basic Regex for generic emoji detection
const EMOJI_REGEX = /\p{Emoji_Presentation}/gu;

const isValidSender = (text: string): boolean => {
  if (!text) return false;
  const t = text.trim();
  if (t.length === 0 || t.length > 50) return false;
  if (/^\d{1,2}:\d{2}/.test(t)) return false; 
  if (/^(AM|PM)$/i.test(t)) return false;     
  if (/^[A-Z][a-z]{2}\s\d{1,2},?\s\d{4}/.test(t)) return false; 
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t)) return false;
  
  const commonLabels = new Set([
      'sent', 'seen', 'liked', 'reacted', 'reply', 'replied', 
      'message', 'chat', 'conversation', 'participants', 
      'search', 'loading', 'active', 'now', 'edited', 
      'unsent', 'forwarded', 'you', 'admin',
      'you sent an attachment.', 'sent an attachment.', 
      'attachment', 'video chat', 'audio call', 
      'missed voice call', 'missed video call'
  ]);
  
  if (commonLabels.has(t.toLowerCase())) return false;
  if (t.toLowerCase().includes('sent an attachment')) return false;

  return true;
};

const extractDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

/**
 * Main Parse Function
 */
export const parseChatFile = async (file: File): Promise<ChatAnalysisResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file content");

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        
        // Pass 1: Extraction
        const rawMessages: RawMessage[] = [];
        let detectedFormat = 'Unknown';

        // --- STRATEGY 1: Meta/Instagram/Facebook (.pam) ---
        const pamElements = doc.querySelectorAll('.pam');
        if (pamElements.length > 0) {
            detectedFormat = 'Instagram/Meta Export';
            pamElements.forEach((el) => {
                const header = el.querySelector('h2, h3, h4') || el.querySelector('._2lem, ._27_v');
                const name = header?.textContent?.trim();
                const timeDiv = el.querySelector('._3-94, ._a6-o');
                const date = extractDate(timeDiv?.textContent || '');
                const contentDiv = el.querySelector('div._a6-p') || el.querySelector('div.message');
                let content = contentDiv?.textContent || "";
                
                let type: RawMessage['type'] = 'text';
                const lowerText = content.toLowerCase();
                const links = contentDiv?.querySelectorAll('a');
                
                if (lowerText.includes('sent an attachment') || lowerText.includes('sent a photo')) {
                    type = 'attachment';
                    if (links && links.length > 0) {
                        links.forEach(a => {
                            if (a.href.includes('instagram.com/reel') || a.href.includes('/reel/')) type = 'reel';
                        });
                    }
                }

                if (name && isValidSender(name) && date) {
                    rawMessages.push({ sender: name, timestamp: date, content, type });
                }
            });
        }

        // --- STRATEGY 2: Telegram ---
        if (rawMessages.length === 0) {
            const telegramMessages = doc.querySelectorAll('.message');
            if (telegramMessages.length > 0) {
                detectedFormat = 'Telegram Export';
                telegramMessages.forEach(msg => {
                    const fromNode = msg.querySelector('.from_name');
                    const name = fromNode?.textContent?.trim();
                    const dateNode = msg.querySelector('.date');
                    const dateStr = dateNode?.getAttribute('title') || dateNode?.textContent || '';
                    const date = extractDate(dateStr);
                    const textNode = msg.querySelector('.text');
                    const content = textNode?.textContent || '';
                    
                    let type: RawMessage['type'] = 'text';
                    if (msg.querySelector('.photo')) type = 'attachment';
                    if (msg.querySelector('.video')) type = 'reel';

                    if (name && isValidSender(name) && date) {
                        rawMessages.push({ sender: name, timestamp: date, content, type });
                    }
                });
            }
        }

        if (rawMessages.length === 0) throw new Error("No messages found or format unrecognized.");

        // Pass 2: Sort & Analyze
        // Sort chronologically (oldest first)
        rawMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Initialize Stats Containers
        const hourlyStats: Record<string, number> = {};
        const timelineStats: Record<string, number> = {};
        const dailyActivity: Record<string, number> = {}; // YYYY-MM-DD -> count
        const monthCounts: Record<string, number> = {}; // YYYY-MM -> count

        // Temporary sender map
        type TempSenderStat = {
            name: string;
            count: number;
            wordCounts: Record<string, number>;
            reelCount: number;
            attachmentCount: number;
            totalLen: number;
            replyTimes: number[];
            consecutiveCount: number;
            maxConsecutive: number;
            emojis: Record<string, number>;
            initiatedCount: number; // > 6 hours gap
            lateNight: number;
            morning: number;
            afternoon: number;
            evening: number;
        };
        const senderMap: Record<string, TempSenderStat> = {};

        const getSender = (name: string): TempSenderStat => {
            if (!senderMap[name]) {
                senderMap[name] = { 
                    name, count: 0, wordCounts: {}, reelCount: 0, attachmentCount: 0, 
                    totalLen: 0, replyTimes: [], consecutiveCount: 0, maxConsecutive: 0, 
                    emojis: {}, initiatedCount: 0, 
                    lateNight: 0, morning: 0, afternoon: 0, evening: 0
                };
            }
            return senderMap[name];
        };

        // Analysis Loop
        let previousMsg: RawMessage | null = null;
        let maxDayStreak = 0;

        rawMessages.forEach((msg) => {
            const sender = getSender(msg.sender);
            
            // Basics
            sender.count++;
            if (msg.type === 'reel') sender.reelCount++;
            if (msg.type === 'attachment') sender.attachmentCount++;
            sender.totalLen += msg.content.length;

            // Words
            const words = msg.content.toLowerCase().replace(/[^\w\s]/gi, '').split(/\s+/);
            words.forEach(w => {
                if (w.length > 1 && !STOP_WORDS.has(w)) sender.wordCounts[w] = (sender.wordCounts[w] || 0) + 1;
            });

            // Emojis
            const emojis = msg.content.match(EMOJI_REGEX) || [];
            emojis.forEach(e => {
                sender.emojis[e] = (sender.emojis[e] || 0) + 1;
            });

            // Time Buckets
            const hour = msg.timestamp.getHours();
            hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
            
            if (hour >= 0 && hour < 4) sender.lateNight++;
            else if (hour >= 4 && hour < 12) sender.morning++;
            else if (hour >= 12 && hour < 20) sender.afternoon++;
            else sender.evening++;

            // Timeline Keys
            const yyyy = msg.timestamp.getFullYear();
            const mm = String(msg.timestamp.getMonth() + 1).padStart(2, '0');
            const dd = String(msg.timestamp.getDate()).padStart(2, '0');
            const dayKey = `${yyyy}-${mm}-${dd}`;
            const monthKey = `${yyyy}-${mm}`;
            
            timelineStats[dayKey] = (timelineStats[dayKey] || 0) + 1;
            dailyActivity[dayKey] = (dailyActivity[dayKey] || 0) + 1;
            monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;

            // Advanced Dynamics
            if (previousMsg) {
                const timeDiff = msg.timestamp.getTime() - previousMsg.timestamp.getTime();
                const timeDiffMinutes = timeDiff / (1000 * 60);

                if (previousMsg.sender !== msg.sender) {
                    // It's a reply!
                    sender.replyTimes.push(timeDiffMinutes);
                    
                    // Did they initiate after a long silence? (> 6 hours)
                    if (timeDiffMinutes > 360) {
                        sender.initiatedCount++;
                    }

                    // Reset consecutive for previous sender
                    const prevSender = getSender(previousMsg.sender);
                    prevSender.consecutiveCount = 0;
                } else {
                    // Double text
                    sender.consecutiveCount++;
                    if (sender.consecutiveCount > sender.maxConsecutive) {
                        sender.maxConsecutive = sender.consecutiveCount;
                    }
                }
            } else {
                // First message ever
                sender.initiatedCount++;
            }
            previousMsg = msg;
        });

        // Calculate Global Streaks (Day based)
        const sortedDays = Object.keys(dailyActivity).sort();
        if (sortedDays.length > 0) {
             let currentStreak = 1;
             let maxStreak = 1;
             let prevDate = new Date(sortedDays[0]);

             for (let i = 1; i < sortedDays.length; i++) {
                 const currDate = new Date(sortedDays[i]);
                 const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                 
                 if (diffDays === 1) {
                     currentStreak++;
                 } else {
                     maxStreak = Math.max(maxStreak, currentStreak);
                     currentStreak = 1;
                 }
                 prevDate = currDate;
             }
             maxDayStreak = Math.max(maxStreak, currentStreak);
        }

        // Busiest Day
        let busiestDay = { date: '', count: 0 };
        Object.entries(dailyActivity).forEach(([date, count]) => {
            if (count > busiestDay.count) busiestDay = { date, count };
        });

        // Busiest Month
        let busiestMonth = '';
        let maxMonthCount = 0;
        Object.entries(monthCounts).forEach(([m, c]) => {
            if (c > maxMonthCount) {
                maxMonthCount = c;
                busiestMonth = m;
            }
        });

        // Longest Gap
        let longestGapDays = 0;
        if (sortedDays.length > 1) {
             let maxGap = 0;
             for (let i = 1; i < sortedDays.length; i++) {
                 const d1 = new Date(sortedDays[i-1]);
                 const d2 = new Date(sortedDays[i]);
                 const diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
                 if (diff > maxGap) maxGap = diff;
             }
             longestGapDays = Math.floor(maxGap);
        }

        // Final Sender Stats Assembly
        const senders: SenderStat[] = Object.values(senderMap).map((s, idx) => {
             const replyTimes = s.replyTimes.sort((a, b) => a - b);
             const avgReply = replyTimes.length ? replyTimes.reduce((a, b) => a + b, 0) / replyTimes.length : 0;
             const fastest = replyTimes.length ? replyTimes[0] * 60 : 0; // seconds
             const slowest = replyTimes.length ? replyTimes[replyTimes.length - 1] : 0; // minutes

             return {
                 name: s.name,
                 count: s.count,
                 color: COLORS[idx % COLORS.length],
                 wordCounts: s.wordCounts,
                 reelCount: s.reelCount,
                 attachmentCount: s.attachmentCount,
                 avgMessageLength: s.count > 0 ? Math.round(s.totalLen / s.count) : 0,
                 avgReplyTimeMinutes: Math.round(avgReply),
                 fastestReplySeconds: Math.round(fastest),
                 slowestReplyMinutes: Math.round(slowest),
                 longestStreakMessages: s.maxConsecutive,
                 emojis: s.emojis,
                 initiatedConversations: s.initiatedCount,
                 lateNightMessages: s.lateNight,
                 morningMessages: s.morning,
                 afternoonMessages: s.afternoon,
                 eveningMessages: s.evening
             };
        }).sort((a, b) => b.count - a.count);

        const firstDate = rawMessages.length > 0 ? rawMessages[0].timestamp : null;
        const lastDate = rawMessages.length > 0 ? rawMessages[rawMessages.length - 1].timestamp : null;
        
        let activeDaysPct = 0;
        if (firstDate && lastDate) {
            const totalDaysSpan = (lastDate.getTime() - firstDate.getTime()) / (1000 * 3600 * 24);
            if (totalDaysSpan > 0) {
                activeDaysPct = Math.round((sortedDays.length / totalDaysSpan) * 100);
            }
        }

        const result: ChatAnalysisResult = {
          fileName: file.name,
          totalMessages: rawMessages.length,
          senders,
          hourlyStats,
          timelineStats,
          totalDays: sortedDays.length,
          firstMessageDate: firstDate ? firstDate.toISOString() : null,
          lastMessageDate: lastDate ? lastDate.toISOString() : null,
          longestGapDays,
          longestDayStreak: maxDayStreak,
          activeDaysPct,
          busiestDay,
          busiestMonth,
          metadata: {
            parsedAt: new Date().toISOString(),
            rawNodeCount: doc.getElementsByTagName('*').length,
            detectedFormat,
            otherAttributes: {} 
          }
        };

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
};