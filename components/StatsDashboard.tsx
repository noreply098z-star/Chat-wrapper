import React, { useMemo } from 'react';
import { ChatAnalysisResult } from '../types';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area 
} from 'recharts';
import { MessageSquare, Users, FileText, CheckCircle2, Film, Image as ImageIcon, Type, Clock, Calendar } from 'lucide-react';

interface StatsDashboardProps {
  results: ChatAnalysisResult[];
  onReset: () => void;
}

const StatsDashboard: React.FC<StatsDashboardProps> = ({ results, onReset }) => {
  
  // Aggregate data across all files
  const aggregatedStats = useMemo(() => {
    const total = results.reduce((acc, r) => acc + r.totalMessages, 0);
    
    const colors = [
        '#4F46E5', '#EC4899', '#10B981', '#F59E0B', 
        '#6366F1', '#8B5CF6', '#EF4444', '#3B82F6'
    ];

    const senderDataMap: Record<string, { 
        count: number, 
        reelCount: number, 
        attachmentCount: number,
        wordCounts: Record<string, number>
    }> = {};

    // Aggregators for charts
    const hourlyMap: Record<string, number> = {};
    const timelineMap: Record<string, number> = {};

    results.forEach(r => {
      // Merge Sender Stats
      r.senders.forEach(s => {
        if (!senderDataMap[s.name]) {
            senderDataMap[s.name] = { count: 0, reelCount: 0, attachmentCount: 0, wordCounts: {} };
        }
        senderDataMap[s.name].count += s.count;
        senderDataMap[s.name].reelCount += s.reelCount;
        senderDataMap[s.name].attachmentCount += s.attachmentCount;
        
        Object.entries(s.wordCounts).forEach(([word, count]) => {
            senderDataMap[s.name].wordCounts[word] = (senderDataMap[s.name].wordCounts[word] || 0) + count;
        });
      });

      // Merge Hourly Stats
      Object.entries(r.hourlyStats).forEach(([hour, count]) => {
        hourlyMap[hour] = (hourlyMap[hour] || 0) + count;
      });

      // Merge Timeline Stats
      Object.entries(r.timelineStats).forEach(([date, count]) => {
        timelineMap[date] = (timelineMap[date] || 0) + count;
      });
    });

    // Process Senders
    const senders = Object.entries(senderDataMap)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, data], idx) => {
        // Find top 5 words
        const sortedWords = Object.entries(data.wordCounts).sort((a, b) => b[1] - a[1]);
        const top5Words = sortedWords.slice(0, 5).map(w => ({ word: w[0], count: w[1] }));

        return {
            name,
            count: data.count,
            reelCount: data.reelCount,
            attachmentCount: data.attachmentCount,
            topWords: top5Words,
            color: colors[idx % colors.length]
        };
      });

    // Find top word overall
    const overallWordCounts: Record<string, number> = {};
    Object.values(senderDataMap).forEach(data => {
        Object.entries(data.wordCounts).forEach(([word, count]) => {
            overallWordCounts[word] = (overallWordCounts[word] || 0) + count;
        });
    });
    const topOverallWord = Object.entries(overallWordCounts).sort((a, b) => b[1] - a[1])[0] || null;

    // Process Hourly Data for Chart
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: hourlyMap[i.toString()] || 0,
        label: `${i}:00`
    }));

    // Process Timeline Data for Chart
    const timelineData = Object.entries(timelineMap)
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([date, count]) => ({ date, count }));

    return { total, senders, topOverallWord, hourlyData, timelineData };
  }, [results]);

  // Custom label renderer for Pie Chart
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    // Position text in the middle of the slice
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
    // Only show label if the slice is large enough (>5%)
    if (percent < 0.05) return null;
  
    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor="middle" 
        dominantBaseline="central" 
        className="text-xs font-bold drop-shadow-md"
        style={{ pointerEvents: 'none' }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (results.length === 0) return null;

  const displaySenders = aggregatedStats.senders.slice(0, 50);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      
      {/* Header Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Messages</p>
            <p className="text-3xl font-bold text-slate-900">{aggregatedStats.total.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Participants</p>
            <p className="text-3xl font-bold text-slate-900">{aggregatedStats.senders.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Type className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Top Word</p>
            <p className="text-xl font-bold text-slate-900 truncate max-w-[120px]" title={aggregatedStats.topOverallWord ? `${aggregatedStats.topOverallWord[0]}` : 'N/A'}>
                {aggregatedStats.topOverallWord ? `"${aggregatedStats.topOverallWord[0]}"` : '-'}
            </p>
            {aggregatedStats.topOverallWord && (
                 <p className="text-xs text-slate-400">{aggregatedStats.topOverallWord[1].toLocaleString()} times</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Files Analyzed</p>
            <p className="text-3xl font-bold text-slate-900">{results.length}</p>
          </div>
        </div>
      </div>

      {/* Charts Section 1: Distribution & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
          <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
             <MessageSquare className="w-5 h-5 text-indigo-500"/> Message Share
          </h3>
          <div className="flex-1 flex items-center justify-center min-h-[350px]">
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={displaySenders}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="count"
                  label={renderCustomizedLabel}
                  labelLine={false}
                >
                  {displaySenders.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value.toLocaleString()} messages`, 'Count']}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle"/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Breakdown List */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col h-[460px]">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
             <Users className="w-5 h-5 text-indigo-500"/> Participant Breakdown
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {displaySenders.map((sender) => {
              const percentage = aggregatedStats.total > 0 
                ? ((sender.count / aggregatedStats.total) * 100).toFixed(1) 
                : 0;
                
              return (
              <div key={sender.name} className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: sender.color }}></div>
                
                <div className="flex items-start justify-between">
                   <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-lg text-slate-800 truncate max-w-[180px]" title={sender.name}>{sender.name}</span>
                        {Number(percentage) > 20 && (
                          <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: sender.color }}>
                            {Math.round(Number(percentage))}%
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-slate-500">
                        {sender.count.toLocaleString()} messages
                      </span>
                   </div>
                   
                   <div className="text-right">
                       <span className="text-2xl font-bold text-slate-700">{percentage}%</span>
                   </div>
                </div>

                {/* Media Stats Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2 rounded border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                         <span className="text-slate-400 mb-1 flex items-center gap-1 uppercase tracking-wider text-[10px] font-bold"><Film className="w-3 h-3"/> Reels</span>
                         <span className="font-semibold text-slate-700 text-sm">{sender.reelCount.toLocaleString()}</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                         <span className="text-slate-400 mb-1 flex items-center gap-1 uppercase tracking-wider text-[10px] font-bold"><ImageIcon className="w-3 h-3"/> Photos</span>
                         <span className="font-semibold text-slate-700 text-sm">{sender.attachmentCount.toLocaleString()}</span>
                    </div>
                </div>
                
                {/* Top 5 Words */}
                <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5 block">Top Words</span>
                    <div className="flex flex-wrap gap-1.5">
                        {sender.topWords.length > 0 ? (
                            sender.topWords.map((w, i) => (
                                <span key={i} className="text-xs bg-white text-slate-600 px-2 py-1 rounded-md border border-slate-200 shadow-sm" title={`${w.count} times`}>
                                    {w.word}
                                </span>
                            ))
                        ) : (
                            <span className="text-xs text-slate-400 italic">No words found</span>
                        )}
                    </div>
                </div>

              </div>
            )})}
            {aggregatedStats.senders.length > 50 && (
                <div className="text-center text-xs text-slate-400 pt-2">
                    And {aggregatedStats.senders.length - 50} others...
                </div>
            )}
          </div>
        </div>

      </div>

      {/* Charts Section 2: Hourly Activity & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Timeline Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
           <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
             <Calendar className="w-5 h-5 text-indigo-500"/> Chat History (Volume)
           </h3>
           <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <AreaChart data={aggregatedStats.timelineData}>
                   <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/>
                         <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                      </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                   <XAxis 
                        dataKey="date" 
                        tick={{fill: '#94a3b8', fontSize: 12}} 
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                        tickFormatter={(str) => {
                            const d = new Date(str);
                            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
                        }}
                   />
                   <YAxis tick={{fill: '#94a3b8', fontSize: 12}} tickLine={false} axisLine={false} />
                   <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                   />
                   <Area type="monotone" dataKey="count" stroke="#6366f1" fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>
        
        {/* Hourly Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
             <Clock className="w-5 h-5 text-indigo-500"/> Daily Habits (Hourly)
          </h3>
          <div style={{ width: '100%', height: 350 }}>
             <ResponsiveContainer>
                <BarChart data={aggregatedStats.hourlyData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                   <XAxis 
                        dataKey="hour" 
                        tick={{fill: '#94a3b8', fontSize: 12}} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(h) => `${h}`}
                   />
                   <YAxis tick={{fill: '#94a3b8', fontSize: 12}} tickLine={false} axisLine={false} />
                   <Tooltip 
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelFormatter={(label) => `${label}:00 - ${label}:59`}
                   />
                   <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
          </div>
          <p className="text-xs text-center text-slate-400 mt-2">Time of Day (0-23 hours)</p>
        </div>

      </div>

      {/* File Details Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Source Files</h3>
            <button 
                onClick={onReset}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
            >
                Analyze New Files
            </button>
        </div>
        <div className="divide-y divide-slate-100">
            {results.map((file, idx) => (
                <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center space-x-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <div>
                            <p className="text-sm font-medium text-slate-800">{file.fileName}</p>
                            <p className="text-xs text-slate-400">Format: {file.metadata.detectedFormat}</p>
                        </div>
                    </div>
                    <span className="text-sm text-slate-600 font-mono">
                        {file.totalMessages.toLocaleString()} msgs
                    </span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default StatsDashboard;
