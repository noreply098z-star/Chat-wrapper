import React, { useMemo } from 'react';
import { ChatAnalysisResult } from '../types';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, LineChart, Line
} from 'recharts';
import { 
  MessageSquare, Users, Zap, Clock, Calendar, 
  Smile, Film, Image as ImageIcon, MessageCircle, Moon, Sun, 
  Activity, Award, HeartHandshake, TrendingUp, History
} from 'lucide-react';

interface StatsDashboardProps {
  results: ChatAnalysisResult[];
  onReset: () => void;
}

const StatsDashboard: React.FC<StatsDashboardProps> = ({ results, onReset }) => {
  
  // Combine all file results into one mega-stat object if needed, 
  // but for simplicity and accuracy of "Streaks", we usually look at the primary file or aggregate.
  // Here we assume aggregating sums for counts, but using weighted averages for rates.
  const stats = useMemo(() => {
    if (results.length === 0) return null;
    
    // Base aggregation
    const main = results[0]; // Take metadata from first
    const totalMessages = results.reduce((acc, r) => acc + r.totalMessages, 0);
    
    // Merge Senders
    const senderMap: Record<string, any> = {};
    results.forEach(res => {
        res.senders.forEach(s => {
            if (!senderMap[s.name]) {
                senderMap[s.name] = { ...s, wordCounts: { ...s.wordCounts }, emojis: { ...s.emojis } };
            } else {
                const exist = senderMap[s.name];
                exist.count += s.count;
                exist.reelCount += s.reelCount;
                exist.attachmentCount += s.attachmentCount;
                exist.lateNightMessages += s.lateNightMessages;
                exist.morningMessages += s.morningMessages;
                exist.afternoonMessages += s.afternoonMessages;
                exist.eveningMessages += s.eveningMessages;
                exist.initiatedConversations += s.initiatedConversations;
                
                // Weighted averages for times
                exist.avgMessageLength = (exist.avgMessageLength + s.avgMessageLength) / 2;
                exist.avgReplyTimeMinutes = (exist.avgReplyTimeMinutes + s.avgReplyTimeMinutes) / 2;
                exist.longestStreakMessages = Math.max(exist.longestStreakMessages, s.longestStreakMessages);
                
                // Merge Dictionaries
                Object.entries(s.wordCounts).forEach(([k, v]) => exist.wordCounts[k] = (exist.wordCounts[k] || 0) + (v as number));
                Object.entries(s.emojis).forEach(([k, v]) => exist.emojis[k] = (exist.emojis[k] || 0) + (v as number));
            }
        });
    });

    const senders = Object.values(senderMap).sort((a: any, b: any) => b.count - a.count);
    
    // Aggregate Timeline
    const timelineMap: Record<string, number> = {};
    const hourlyMap: Record<string, number> = {};
    results.forEach(res => {
        Object.entries(res.timelineStats).forEach(([k,v]) => timelineMap[k] = (timelineMap[k] || 0) + v);
        Object.entries(res.hourlyStats).forEach(([k,v]) => hourlyMap[k] = (hourlyMap[k] || 0) + v);
    });

    const timelineData = Object.entries(timelineMap)
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([date, count]) => ({ date, count }));

    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: hourlyMap[i.toString()] || 0,
        label: `${i}:00`
    }));

    // Calculate Busiest Month from aggregated timeline
    const monthCounts: Record<string, number> = {};
    Object.entries(timelineMap).forEach(([date, count]) => {
       // date is YYYY-MM-DD
       if (date.length >= 7) {
           const month = date.substring(0, 7);
           monthCounts[month] = (monthCounts[month] || 0) + count;
       }
    });

    let busiestMonth = '';
    let maxMonthCount = 0;
    Object.entries(monthCounts).forEach(([m, c]) => {
       if (c > maxMonthCount) {
           maxMonthCount = c;
           busiestMonth = m;
       }
    });

    // Calculate date range
    const allFirstDates = results.map(r => r.firstMessageDate).filter(d => d).sort();
    const allLastDates = results.map(r => r.lastMessageDate).filter(d => d).sort();
    const firstDate = allFirstDates.length > 0 ? allFirstDates[0] : null;
    const lastDate = allLastDates.length > 0 ? allLastDates[allLastDates.length - 1] : null;

    return {
        totalMessages,
        senders,
        timelineData,
        hourlyData,
        // Global stats from first file mostly valid for streaks if single chat export
        longestDayStreak: Math.max(...results.map(r => r.longestDayStreak)),
        longestGapDays: Math.max(...results.map(r => r.longestGapDays)),
        activeDaysPct: results[0].activeDaysPct,
        busiestDay: results.reduce((prev, curr) => (curr.busiestDay.count > prev.count ? curr.busiestDay : prev), {count:0, date:''}),
        firstDate,
        lastDate,
        busiestMonth
    };
  }, [results]);

  if (!stats) return null;

  const primarySender = stats.senders[0];
  const secondarySender = stats.senders[1] || null;

  // Format Helpers
  const formatDuration = (mins: number) => {
      if (mins < 1) return '< 1 min';
      if (mins < 60) return `${Math.round(mins)} mins`;
      const hrs = Math.round(mins / 60);
      return `${hrs} hr${hrs > 1 ? 's' : ''}`;
  };

  const getTopEmojis = (emojiMap: Record<string, number>) => {
      return Object.entries(emojiMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([char]) => char);
  };

  const getDayPart = (sender: any) => {
      const { morningMessages, afternoonMessages, eveningMessages, lateNightMessages } = sender;
      const max = Math.max(morningMessages, afternoonMessages, eveningMessages, lateNightMessages);
      if (max === morningMessages) return 'Morning Bird';
      if (max === afternoonMessages) return 'Daytime Chatter';
      if (max === eveningMessages) return 'Evening Relaxer';
      return 'Night Owl';
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      
      {/* 1. HERO & BALANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dominance Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <MessageCircle size={200} />
            </div>
            <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                    <HeartHandshake className="w-8 h-8"/> Conversation Balance
                </h2>
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex-1 space-y-6 w-full">
                         {stats.senders.slice(0, 2).map((s: any) => (
                             <div key={s.name} className="space-y-2">
                                 <div className="flex justify-between items-end">
                                     <span className="font-semibold text-lg">{s.name}</span>
                                     <span className="text-2xl font-bold">{Math.round((s.count / stats.totalMessages) * 100)}%</span>
                                 </div>
                                 <div className="w-full h-4 bg-white/20 rounded-full overflow-hidden">
                                     <div 
                                        className="h-full bg-white transition-all duration-1000" 
                                        style={{ width: `${(s.count / stats.totalMessages) * 100}%` }}
                                     />
                                 </div>
                                 <div className="flex justify-between text-xs text-indigo-200">
                                     <span>{s.count.toLocaleString()} messages</span>
                                     <span>{s.wordCounts ? Object.values(s.wordCounts).reduce((a:any,b:any)=>a+b, 0).toLocaleString() : 0} words</span>
                                 </div>
                             </div>
                         ))}
                    </div>
                    
                    <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm border border-white/20 min-w-[200px] text-center">
                        <Award className="w-8 h-8 mx-auto mb-2 text-yellow-300" />
                        <div className="text-sm uppercase tracking-wider text-indigo-200 mb-1">Top Chatter</div>
                        <div className="text-xl font-bold">{primarySender.name}</div>
                        <div className="text-xs text-indigo-300 mt-2">
                            {secondarySender && `Sends ${(primarySender.count / secondarySender.count).toFixed(1)}x more messages`}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Global Stats Grid */}
        <div className="grid grid-cols-1 gap-4">
             <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
                 <div className="flex items-center gap-3 text-slate-500 mb-2">
                     <TrendingUp className="w-5 h-5 text-emerald-500" />
                     <span className="text-sm font-medium uppercase tracking-wider">Total Messages</span>
                 </div>
                 <div className="text-4xl font-extrabold text-slate-800">
                     {stats.totalMessages.toLocaleString()}
                 </div>
             </div>
             <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
                 <div className="flex items-center gap-3 text-slate-500 mb-2">
                     <Calendar className="w-5 h-5 text-blue-500" />
                     <span className="text-sm font-medium uppercase tracking-wider">Total Days</span>
                 </div>
                 <div className="text-4xl font-extrabold text-slate-800">
                     {stats.timelineData.length.toLocaleString()}
                 </div>
                 <div className="text-xs text-slate-400 mt-1">
                     Since {new Date(stats.firstDate!).toLocaleDateString()}
                 </div>
             </div>
        </div>
      </div>

      {/* 2. REPLY DYNAMICS */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-500"/> Reply Dynamics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.senders.slice(0, 2).map((s: any) => (
                  <div key={s.name} className="col-span-2 bg-slate-50 rounded-2xl p-6 border border-slate-100">
                      <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: s.color }}>
                              {s.name.charAt(0)}
                          </div>
                          <div>
                              <div className="font-bold text-slate-800">{s.name}</div>
                              <div className="text-xs text-slate-500">Reply Style</div>
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-4 rounded-xl shadow-sm">
                              <div className="text-xs text-slate-400 mb-1">Avg Reply Time</div>
                              <div className="text-lg font-bold text-slate-700">{formatDuration(s.avgReplyTimeMinutes)}</div>
                          </div>
                          <div className="bg-white p-4 rounded-xl shadow-sm">
                              <div className="text-xs text-slate-400 mb-1">Fastest Reply</div>
                              <div className="text-lg font-bold text-emerald-600">{s.fastestReplySeconds}s</div>
                          </div>
                          <div className="bg-white p-4 rounded-xl shadow-sm">
                              <div className="text-xs text-slate-400 mb-1">Conversation Starter</div>
                              <div className="text-lg font-bold text-indigo-600">{s.initiatedConversations} <span className="text-xs font-normal text-slate-400">times</span></div>
                          </div>
                          <div className="bg-white p-4 rounded-xl shadow-sm">
                              <div className="text-xs text-slate-400 mb-1">Slowest Reply</div>
                              <div className="text-lg font-bold text-red-500">{formatDuration(s.slowestReplyMinutes)}</div>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      </div>

      {/* 3. TIME HABITS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-indigo-500"/> Hourly Activity
              </h3>
              <div className="h-64 w-full">
                  <ResponsiveContainer>
                    <BarChart data={stats.hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                        <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                        <Tooltip 
                            cursor={{fill: '#f8fafc'}}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>
          
          <div className="bg-slate-900 rounded-3xl shadow-xl p-8 text-white flex flex-col justify-between relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                   <Moon size={120} />
               </div>
               <div>
                   <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                       <Moon className="w-5 h-5 text-indigo-400"/> Late Night Talks
                   </h3>
                   <p className="text-indigo-200 text-xs mb-6">Messages between 12 AM - 4 AM</p>
                   
                   <div className="space-y-4">
                       {stats.senders.slice(0, 2).map((s: any) => (
                           <div key={s.name} className="flex justify-between items-center">
                               <span className="font-medium text-sm">{s.name}</span>
                               <span className="font-mono text-indigo-300">{s.lateNightMessages}</span>
                           </div>
                       ))}
                   </div>
               </div>
               <div className="mt-8 pt-6 border-t border-white/10">
                   <div className="text-xs text-slate-400 mb-1">Most Active Time</div>
                   <div className="text-2xl font-bold">
                       {stats.hourlyData.reduce((p:any, c:any) => c.count > p.count ? c : p).label}:00
                   </div>
               </div>
          </div>
      </div>

      {/* 4. INTENSITY & STREAKS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg">
               <Activity className="w-8 h-8 mb-4 opacity-80" />
               <div className="text-3xl font-extrabold mb-1">{stats.longestDayStreak} Days</div>
               <div className="text-sm font-medium opacity-90">Longest Streak</div>
               <p className="text-xs opacity-70 mt-2">Consecutive days talking</p>
          </div>
          
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
               <div className="flex items-center gap-2 mb-4 text-slate-500">
                   <History className="w-5 h-5" />
                   <span className="text-sm font-bold uppercase">Longest Silence</span>
               </div>
               <div className="text-3xl font-bold text-slate-800">{stats.longestGapDays} Days</div>
               <div className="w-full bg-slate-100 h-2 mt-4 rounded-full overflow-hidden">
                   <div className="bg-slate-300 h-full" style={{width: '100%'}}></div>
               </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
               <div className="flex items-center gap-2 mb-4 text-slate-500">
                   <Calendar className="w-5 h-5" />
                   <span className="text-sm font-bold uppercase">Busiest Day</span>
               </div>
               <div className="text-xl font-bold text-slate-800">{new Date(stats.busiestDay.date).toLocaleDateString()}</div>
               <div className="text-emerald-600 font-bold text-sm mt-1">{stats.busiestDay.count} msgs</div>
          </div>
          
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
               <div className="flex items-center gap-2 mb-4 text-slate-500">
                   <Sun className="w-5 h-5" />
                   <span className="text-sm font-bold uppercase">Consistency</span>
               </div>
               <div className="text-3xl font-bold text-slate-800">{stats.activeDaysPct}%</div>
               <p className="text-xs text-slate-400 mt-1">of days had activity</p>
          </div>
      </div>

      {/* 5. STYLE & PERSONALITY */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-500"/> Chat Personality
          </h3>
          <div className="overflow-x-auto">
              <table className="w-full">
                  <thead>
                      <tr className="border-b border-slate-100">
                          <th className="text-left pb-4 pl-4 text-slate-400 font-medium text-sm">Metric</th>
                          {stats.senders.slice(0, 2).map((s: any) => (
                              <th key={s.name} className="pb-4 text-center font-bold text-slate-700">{s.name}</th>
                          ))}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      <tr>
                          <td className="py-4 pl-4 font-medium text-slate-600">Avg Message Length</td>
                          {stats.senders.slice(0, 2).map((s: any) => (
                              <td key={s.name} className="py-4 text-center">
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.avgMessageLength > 40 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                      {s.avgMessageLength} chars
                                  </span>
                                  <div className="text-[10px] text-slate-400 mt-1">
                                      {s.avgMessageLength > 60 ? 'Paragraph Texter' : s.avgMessageLength < 20 ? 'Rapid Fire' : 'Balanced'}
                                  </div>
                              </td>
                          ))}
                      </tr>
                      <tr>
                          <td className="py-4 pl-4 font-medium text-slate-600">Top Emojis</td>
                          {stats.senders.slice(0, 2).map((s: any) => (
                              <td key={s.name} className="py-4 text-center text-xl">
                                  {getTopEmojis(s.emojis).join(' ')}
                              </td>
                          ))}
                      </tr>
                      <tr>
                          <td className="py-4 pl-4 font-medium text-slate-600">Double Texting</td>
                          {stats.senders.slice(0, 2).map((s: any) => (
                              <td key={s.name} className="py-4 text-center">
                                  <span className="font-bold text-slate-700">{s.longestStreakMessages}</span>
                                  <span className="text-xs text-slate-400 block">Max consecutive msgs</span>
                              </td>
                          ))}
                      </tr>
                      <tr>
                          <td className="py-4 pl-4 font-medium text-slate-600">Active Time</td>
                          {stats.senders.slice(0, 2).map((s: any) => (
                              <td key={s.name} className="py-4 text-center text-sm text-slate-600">
                                  {getDayPart(s)}
                              </td>
                          ))}
                      </tr>
                  </tbody>
              </table>
          </div>
      </div>

      {/* 6. MEDIA & EXPRESSION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Film className="w-5 h-5 text-pink-500"/> Media Shared
              </h3>
              <div className="space-y-6">
                   {stats.senders.slice(0, 2).map((s: any) => (
                       <div key={s.name}>
                           <div className="flex justify-between text-sm mb-2">
                               <span className="font-medium">{s.name}</span>
                               <span className="text-slate-500">{s.reelCount} Reels • {s.attachmentCount} Photos</span>
                           </div>
                           <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                               <div style={{width: `${(s.reelCount / (s.reelCount + s.attachmentCount + 1)) * 100}%`}} className="bg-pink-500"></div>
                               <div style={{width: `${(s.attachmentCount / (s.reelCount + s.attachmentCount + 1)) * 100}%`}} className="bg-blue-500"></div>
                           </div>
                       </div>
                   ))}
                   <div className="flex gap-4 text-xs justify-center mt-4">
                       <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-pink-500"></div> Reels</span>
                       <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Photos/Files</span>
                   </div>
              </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Smile className="w-5 h-5 text-yellow-500"/> Vocabulary
              </h3>
              <div className="flex flex-wrap gap-2">
                   {/* There was a small error in previous snippet accessing topWords which isn't on SenderStat anymore, but wordCounts is. */}
                   {/* We will aggregate words here for display */}
                   {(() => {
                        const allWords: Record<string, number> = {};
                        stats.senders.forEach((s: any) => {
                            Object.entries(s.wordCounts).forEach(([w, c]) => {
                                allWords[w] = (allWords[w] || 0) + (c as number);
                            });
                        });
                        return Object.entries(allWords)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 15)
                            .map(([word], idx) => (
                               <span key={idx} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-600 font-medium">
                                   {word}
                               </span>
                            ));
                   })()}
              </div>
          </div>
      </div>

      {/* 7. CHAT JOURNEY (Timeline) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
             <Activity className="w-6 h-6 text-emerald-500"/> The Journey
          </h3>
          <div className="h-72 w-full">
               <ResponsiveContainer>
                    <AreaChart data={stats.timelineData}>
                         <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                         <XAxis 
                            dataKey="date" 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                            axisLine={false} 
                            tickLine={false} 
                            tickFormatter={(str) => {
                                const d = new Date(str);
                                return `${d.getMonth()+1}/${d.getFullYear().toString().substr(2)}`;
                            }}
                            minTickGap={40}
                         />
                         <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            labelFormatter={(l) => new Date(l).toLocaleDateString(undefined, {dateStyle: 'long'})}
                         />
                         <Area type="monotone" dataKey="count" stroke="#10b981" fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
               </ResponsiveContainer>
          </div>
          
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">First Message</div>
                  <div className="font-bold text-slate-700 text-sm">{stats.firstDate ? new Date(stats.firstDate).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Last Message</div>
                  <div className="font-bold text-slate-700 text-sm">{stats.lastDate ? new Date(stats.lastDate).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Duration</div>
                  <div className="font-bold text-slate-700 text-sm">{stats.timelineData.length} active days</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Busiest Month</div>
                  <div className="font-bold text-slate-700 text-sm">{stats.busiestMonth}</div>
              </div>
          </div>
      </div>

      <div className="flex justify-center pt-8">
           <button onClick={onReset} className="flex items-center gap-2 text-indigo-600 font-medium hover:bg-indigo-50 px-6 py-3 rounded-full transition-colors">
               Analyze Another File
           </button>
      </div>
    </div>
  );
};

export default StatsDashboard;