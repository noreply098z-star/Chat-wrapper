import React, { useCallback } from 'react';
import { UploadCloud, FileText, AlertCircle, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { FileProgress } from '../types';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
  error?: string | null;
  filesProgress?: FileProgress[];
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected, isProcessing, error, filesProgress = [] }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (isProcessing) return;

      const files = Array.from(e.dataTransfer.files).filter(
        (file: File) => file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')
      );
      
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected, isProcessing]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`relative group border-2 border-dashed rounded-xl p-12 transition-all duration-300 ease-in-out
          ${isProcessing 
            ? 'border-gray-300 bg-gray-50 cursor-wait' 
            : 'border-indigo-300 bg-white hover:bg-indigo-50 hover:border-indigo-500 cursor-pointer shadow-sm hover:shadow-md'
          }
        `}
      >
        <input
          type="file"
          multiple
          accept=".html,.htm"
          onChange={handleFileInput}
          disabled={isProcessing}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          aria-label="Upload HTML files"
        />
        
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className={`p-4 rounded-full ${isProcessing ? 'bg-gray-100' : 'bg-indigo-100 group-hover:bg-indigo-200'} transition-colors`}>
            {isProcessing ? (
              <Loader2 className="animate-spin w-8 h-8 text-indigo-600" />
            ) : (
              <UploadCloud className="w-8 h-8 text-indigo-600" />
            )}
          </div>
          
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-800">
              {isProcessing ? 'Analyzing Chats...' : 'Upload Chat Logs'}
            </h3>
            <p className="text-sm text-slate-500">
              Drag & drop .html files here or click to browse
            </p>
          </div>
          
          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
            <FileText className="w-3 h-3" />
            <span>Supported formats: HTML exports (Instagram, Telegram, etc.)</span>
          </div>
        </div>
      </div>

      {/* Progress List */}
      {filesProgress.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            File Progress
          </div>
          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {filesProgress.map((file, idx) => (
              <div key={idx} className="px-4 py-2 flex items-center justify-between">
                <span className="text-sm text-slate-700 truncate max-w-[70%]">{file.name}</span>
                <div className="flex items-center">
                  {file.status === 'pending' && <span className="text-xs text-slate-400">Pending</span>}
                  {file.status === 'processing' && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                  {file.status === 'complete' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  {file.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
