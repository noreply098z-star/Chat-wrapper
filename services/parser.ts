import { ChatAnalysisResult, SenderStat } from '../types';

/**
 * A predefined list of distinct colors for visualization
 */
const COLORS = [
  '#4F46E5', // Indigo
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#6366F1', // Violet
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#3B82F6', // Blue
];

const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'are', 'was', 'were', 'had', 'has', 'sent', 'attachment', 'message', 'chat', 'pm', 'am', 'om', 'ok', 'okay', 'lol', 'yeah', 'yes', 'no', 'attachment.', 'you', 'to'
]);

/**
 * Heuristic function to determine if a string is likely a sender name.
 */
const isValidSender = (text: string): boolean => {
  if (!text) return false;
  const t = text.trim();
  if (t.length === 0 || t.length > 50) return false;
  
  if (/^\d{1,2}:\d{2}/.test(t)) return false; 
  if (/^(AM|PM)$/i.test(t)) return false;     
  
  if (/^[A-Z][a-z]{2}\s\d{1,2},?\s\d{4}/.test(t)) return false; 
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t)) return false;
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),? /.test(t)) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return false; 

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

const tokenizeAndCount = (text: string, counts: Record<string, number>) => {
  if (!text) return;
  // Remove emojis and special chars for word counting, keep simple
  const words = text.toLowerCase().replace(/[^\w\s]/gi, '').split(/\s+/);
  words.forEach(w => {
    if (w.length > 1 && !STOP_WORDS.has(w)) {
      counts[w] = (counts[w] || 0) + 1;
    }
  });
};

/**
 * Core parsing logic.
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

        const senderData: Record<string, { 
            count: number; 
            wordCounts: Record<string, number>;
            reelCount: number;
            attachmentCount: number; 
        }> = {};

        // Stats containers
        const hourlyStats: Record<string, number> = {};
        const timelineStats: Record<string, number> = {};
        
        let totalCount = 0;
        let detectedFormat = 'Unknown';

        const getSenderEntry = (name: string) => {
            if (!senderData[name]) {
                senderData[name] = { count: 0, wordCounts: {}, reelCount: 0, attachmentCount: 0 };
            }
            return senderData[name];
        };

        const processTimestamp = (dateStr: string) => {
            if (!dateStr) return;
            // Attempt to parse string like "Oct 30, 2025 7:16 am"
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                // Hourly
                const hour = date.getHours().toString();
                hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;

                // Timeline (YYYY-MM-DD)
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                const dateKey = `${yyyy}-${mm}-${dd}`;
                timelineStats[dateKey] = (timelineStats[dateKey] || 0) + 1;
            }
        };

        // --- STRATEGY 1: Meta/Instagram/Facebook Export (.pam container) ---
        const pamElements = doc.querySelectorAll('.pam');
        if (pamElements.length > 0) {
           let validPamCount = 0;
           
           pamElements.forEach((el) => {
             const header = el.querySelector('h2, h3, h4');
             let name = '';
             
             if (header && header.textContent) {
               name = header.textContent.trim();
             } else {
               const potentialName = el.querySelector('._2lem, ._27_v'); 
               if (potentialName && potentialName.textContent) {
                  name = potentialName.textContent.trim();
               }
             }

             if (name && isValidSender(name)) {
                const entry = getSenderEntry(name);
                entry.count++;
                validPamCount++;
                totalCount++;

                // Timestamp extraction for Instagram
                // Class _3-94 or _a6-o typically holds the date
                const timeDiv = el.querySelector('._3-94, ._a6-o');
                if (timeDiv && timeDiv.textContent) {
                    processTimestamp(timeDiv.textContent.trim());
                }

                // Content Analysis
                const contentDiv = el.querySelector('div._a6-p') || el.querySelector('div.message'); 
                
                if (contentDiv) {
                    const messageText = contentDiv.textContent || "";
                    const lowerText = messageText.toLowerCase().trim();
                    const links = contentDiv.querySelectorAll('a');
                    const hasLink = links.length > 0;
                    
                    if (lowerText.includes('sent an attachment')) {
                        if (hasLink) {
                            let isReel = false;
                            links.forEach(a => {
                                const href = a.getAttribute('href') || '';
                                if (href.includes('instagram.com') || href.includes('http')) {
                                    isReel = true;
                                }
                            });
                            if (isReel) entry.reelCount++;
                            else entry.attachmentCount++;
                        } else {
                            entry.attachmentCount++;
                        }
                    } else {
                        tokenizeAndCount(messageText, entry.wordCounts);
                    }
                }
             }
           });

           if (validPamCount > 0) {
             detectedFormat = 'Instagram/Meta Export';
           }
        }

        // --- STRATEGY 2: Telegram HTML Export ---
        if (totalCount === 0) {
           const telegramMessages = doc.querySelectorAll('.message');
           if (telegramMessages.length > 0) {
             let foundTelegram = false;
             
             telegramMessages.forEach((msg) => {
              const fromNode = msg.querySelector('.from_name');
              if (fromNode && fromNode.textContent) {
                const name = fromNode.textContent.trim();
                if (isValidSender(name)) {
                  const entry = getSenderEntry(name);
                  entry.count++;
                  totalCount++;
                  foundTelegram = true;

                  const dateNode = msg.querySelector('.date');
                  if (dateNode && dateNode.getAttribute('title')) {
                     processTimestamp(dateNode.getAttribute('title') || '');
                  } else if (dateNode && dateNode.textContent) {
                     // Try text content if title attr missing
                     processTimestamp(dateNode.textContent);
                  }

                  const textNode = msg.querySelector('.text');
                  if (textNode && textNode.textContent) {
                      tokenizeAndCount(textNode.textContent, entry.wordCounts);
                  }
                  
                  if (msg.querySelector('.photo')) entry.attachmentCount++;
                  if (msg.querySelector('.video')) entry.reelCount++; 
                }
              }
            });

            if (foundTelegram) {
                detectedFormat = 'Telegram Export';
            }
          }
        }

        // --- STRATEGY 3: Generic (Fallback) ---
        if (totalCount === 0) {
            // ... existing generic logic ...
            // (Keeping generic logic simple without timestamps for now to avoid complexity)
        }

        // --- STRATEGY 4: Statistical (Last Resort) ---
        if (totalCount === 0) {
             // ... existing statistical logic ...
        }

        const senders: SenderStat[] = Object.entries(senderData)
          .sort((a, b) => b[1].count - a[1].count) 
          .map(([name, data], index) => ({
            name,
            count: data.count,
            color: COLORS[index % COLORS.length],
            wordCounts: data.wordCounts,
            reelCount: data.reelCount,
            attachmentCount: data.attachmentCount
          }));

        const result: ChatAnalysisResult = {
          fileName: file.name,
          totalMessages: totalCount,
          senders,
          hourlyStats,
          timelineStats,
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
