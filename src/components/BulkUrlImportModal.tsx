'use client';

import { useState } from 'react';
import type { Prospect } from '@/types';

interface BulkUrlImportModalProps {
  onClose: () => void;
  onImport: (prospects: Partial<Prospect>[]) => void;
  existingUrls: string[];
}

export function BulkUrlImportModal({ onClose, onImport, existingUrls }: BulkUrlImportModalProps) {
  const [urls, setUrls] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<string | null>(null);

  const handleImport = async () => {
    setError('');
    setProgress(null);

    // Parse URLs from textarea
    const urlList = urls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);

    if (urlList.length === 0) {
      setError('Please enter at least one LinkedIn URL');
      return;
    }

    // Check for duplicates against existing prospects
    const normalizedExisting = new Set(
      existingUrls.map(u => u.toLowerCase().replace(/\/+$/, '').split('?')[0])
    );

    const newUrls: string[] = [];
    const duplicates: string[] = [];

    for (const url of urlList) {
      const normalized = url.toLowerCase().replace(/\/+$/, '').split('?')[0];
      if (normalizedExisting.has(normalized)) {
        duplicates.push(url);
      } else {
        newUrls.push(url);
      }
    }

    if (newUrls.length === 0) {
      setError(`All ${duplicates.length} URLs are already in your database.`);
      return;
    }

    setIsLoading(true);
    setProgress(`Fetching ${newUrls.length} profiles from LinkedIn...`);

    try {
      const response = await fetch('/api/import/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: newUrls }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import profiles');
      }

      // Log debug info to help identify correct field names from Apify
      if (data.debug) {
        console.log('Apify available fields:', data.debug.availableFields);
        console.log('Apify profile picture values:', data.debug.sampleValues);
      }

      if (data.prospects && data.prospects.length > 0) {
        console.log('First imported prospect:', data.prospects[0]);
        setProgress(`Successfully fetched ${data.prospects.length} profiles!`);

        // Pass prospects to parent
        onImport(data.prospects);

        // Show summary and close
        const summary = [];
        summary.push(`Imported: ${data.prospects.length}`);
        if (duplicates.length > 0) {
          summary.push(`Duplicates skipped: ${duplicates.length}`);
        }
        if (data.stats?.invalidUrls?.length > 0) {
          summary.push(`Invalid URLs: ${data.stats.invalidUrls.length}`);
        }

        alert(summary.join('\n'));
        onClose();
      } else {
        setError('No profiles were returned. Please check the URLs and try again.');
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import profiles');
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const urlCount = urls.split('\n').filter(u => u.trim()).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Bulk Import from LinkedIn</h2>
            <p className="text-sm text-gray-500 mt-1">
              Paste LinkedIn profile URLs (one per line) to import
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {progress && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center">
              <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {progress}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              LinkedIn Profile URLs
            </label>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder={`https://www.linkedin.com/in/johndoe
https://www.linkedin.com/in/janesmith
https://www.linkedin.com/in/bobwilson`}
              rows={12}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="mt-2 text-sm text-gray-500">
              {urlCount > 0 ? `${urlCount} URL${urlCount !== 1 ? 's' : ''} entered` : 'Enter one URL per line'}
            </p>
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">How it works:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>1. Paste LinkedIn profile URLs (one per line)</li>
              <li>2. We&apos;ll fetch profile data using the Apify scraper</li>
              <li>3. ICP scores are calculated automatically</li>
              <li>4. Duplicates are skipped (based on LinkedIn URL)</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isLoading || urlCount === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Importing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import {urlCount} Profile{urlCount !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
