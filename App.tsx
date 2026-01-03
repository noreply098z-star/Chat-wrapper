import { useState } from 'react';
import { parseChatFile } from './services/parser';
import FileUploader from './components/FileUploader';
import StatsDashboard from './components/StatsDashboard';
import { ChatAnalysisResult, UploadStatus, FileProgress } from './types';
import { ShieldCheck, BarChart3 } from 'lucide-react';

function App() {
  const [results, setResults] = useState<ChatAnalysisResult[]>([]);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [filesProgress, setFilesProgress] = useState<FileProgress[]>([]);

  const handleFilesSelected = async (files: File[]) => {
    setStatus('parsing');
    setError(null);
    setFilesProgress(files.map(f => ({ name: f.name, status: 'pending' })));
    
    const newResults: ChatAnalysisResult[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Update status to processing
        setFilesProgress(prev => prev.map((fp, idx) => idx === i ? { ...fp, status: 'processing' } : fp));
        
        // Small delay to allow UI to render status change
        await new Promise(r => setTimeout(r, 50));

        try {
          const result = await parseChatFile(file);
          if (result.totalMessages > 0) {
            newResults.push(result);
            setFilesProgress(prev => prev.map((fp, idx) => idx === i ? { ...fp, status: 'complete' } : fp));
          } else {
             console.warn(`No messages found in ${file.name}`);
             setFilesProgress(prev => prev.map((fp, idx) => idx === i ? { ...fp, status: 'error' } : fp));
          }
        } catch (e) {
          console.error(`Error parsing ${file.name}`, e);
          setFilesProgress(prev => prev.map((fp, idx) => idx === i ? { ...fp, status: 'error' } : fp));
        }
      }

      if (newResults.length === 0) {
        // Only set global error if NO files succeeded
        const allFailed = files.length > 0; // if we had files and result is empty
        if (allFailed) {
            setError("Could not detect any messages in the uploaded files. Ensure they are valid HTML chat exports.");
            setStatus('error');
        } else {
            setStatus('idle');
        }
      } else {
        setResults((prev) => [...prev, ...newResults]);
        setStatus('complete');
      }
    } catch (err) {
      setError("An unexpected error occurred while processing files.");
      setStatus('error');
    } finally {
        // Wait a bit to show complete status before potentially hiding uploader
        if(newResults.length > 0) {
             setTimeout(() => setStatus('complete'), 500);
        }
    }
  };

  const handleReset = () => {
    setResults([]);
    setFilesProgress([]);
    setStatus('idle');
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">ChatMetric</span>
            </div>
            <div className="flex items-center space-x-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              <span>Private & Client-side only</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        
        {/* Intro Text */}
        {results.length === 0 && (
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <h1 className="text-4xl font-extrabold text-slate-900 mb-4">
              Visualize your chat history
            </h1>
            <p className="text-lg text-slate-600">
              Upload your HTML chat exports to see exactly how many messages you've exchanged. 
              We strictly count messages and never display or store your private metadata.
            </p>
          </div>
        )}

        <div className="space-y-12">
          {/* Upload Section */}
          {results.length === 0 && (
            <div className="flex justify-center animate-fade-in-up">
              <FileUploader 
                onFilesSelected={handleFilesSelected} 
                isProcessing={status === 'parsing'}
                error={error}
                filesProgress={filesProgress}
              />
            </div>
          )}

          {/* Results Section */}
          {results.length > 0 && (
            <StatsDashboard results={results} onReset={handleReset} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
          <p>ChatMetric processes all files locally in your browser.</p>
          <p className="mt-2 text-xs">No data is sent to the cloud.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;