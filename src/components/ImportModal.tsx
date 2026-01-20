'use client';

import { useState, useCallback } from 'react';
import { parseExcelFile } from '@/lib/import';
import type { Prospect, PipelineRecord } from '@/types';

interface ImportModalProps {
  onClose: () => void;
  onImport: (prospects: Partial<Prospect>[], pipelineData: Map<string, Partial<PipelineRecord>>) => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';

export function ImportModal({ onClose, onImport }: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [prospects, setProspects] = useState<Partial<Prospect>[]>([]);
  const [pipelineData, setPipelineData] = useState<Map<string, Partial<PipelineRecord>>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);

    try {
      const result = await parseExcelFile(selectedFile);
      setProspects(result.prospects);
      setPipelineData(result.pipelineData);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      handleFileSelect(droppedFile);
    } else {
      setError('Please upload an Excel file (.xlsx or .xls)');
    }
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  const handleImport = useCallback(() => {
    setStep('importing');
    // Simulate a small delay for UX
    setTimeout(() => {
      onImport(prospects, pipelineData);
      setStep('done');
    }, 500);
  }, [prospects, pipelineData, onImport]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Import Prospects</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'upload' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
            >
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-600 mb-2">
                Drag and drop your Excel file here, or
              </p>
              <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                <span>Browse Files</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
              <p className="text-sm text-gray-500 mt-4">
                Supports Excel files with &quot;WORKING&quot; and &quot;Scraped&quot; tabs
              </p>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div className="flex items-center mb-4">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium text-gray-900">{file?.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-3xl font-bold text-gray-900">{prospects.length}</p>
                  <p className="text-sm text-gray-600">Prospects found</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-3xl font-bold text-gray-900">{pipelineData.size}</p>
                  <p className="text-sm text-gray-600">With pipeline status</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Preview</h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {prospects.slice(0, 5).map((prospect, index) => (
                    <div key={index} className="flex items-center justify-between bg-white rounded p-2">
                      <div>
                        <p className="font-medium text-gray-900">{prospect.fullName}</p>
                        <p className="text-sm text-gray-500">{prospect.companyName}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        prospect.icpScore && prospect.icpScore >= 70 ? 'bg-green-100 text-green-700' :
                        prospect.icpScore && prospect.icpScore >= 40 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        ICP: {prospect.icpScore || 0}
                      </span>
                    </div>
                  ))}
                  {prospects.length > 5 && (
                    <p className="text-sm text-gray-500 text-center">
                      And {prospects.length - 5} more...
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="text-center py-8">
              <svg className="animate-spin w-12 h-12 mx-auto text-blue-600 mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-gray-600">Importing prospects...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Import Complete</h3>
              <p className="text-gray-600">
                Successfully imported {prospects.length} prospects
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          {step === 'upload' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => { setStep('upload'); setFile(null); setProspects([]); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Import {prospects.length} Prospects
              </button>
            </>
          )}

          {step === 'done' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
