'use client';

import { useState, useCallback } from 'react';
import type { ProspectWithPipeline, ResponseClassification, GeneratedResponse, ResponseOption } from '@/types';

interface ResponseGeneratorProps {
  prospect: ProspectWithPipeline;
  onClose: () => void;
}

const CLASSIFICATION_LABELS: Record<ResponseClassification, { label: string; color: string; description: string }> = {
  problem_aware: {
    label: 'Problem Aware',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'They confirmed the pain point exists'
  },
  curious: {
    label: 'Curious',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Asking questions, wants to know more'
  },
  hot_lead: {
    label: 'Hot Lead',
    color: 'bg-red-100 text-red-800 border-red-200',
    description: 'Actively looking - move fast!'
  },
  non_committal: {
    label: 'Non-Committal',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Vague response, needs more probing'
  },
  deflecting: {
    label: 'Deflecting',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    description: 'Pointing to someone else'
  },
  asking_who_you_are: {
    label: 'Asking Who You Are',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Wants to know your angle'
  },
  not_interested: {
    label: 'Not Interested',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    description: 'Polite decline'
  },
  has_competitor: {
    label: 'Has Competitor',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Using Route, InsureShield, etc.'
  },
  wrong_target: {
    label: 'Wrong Target',
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    description: "Doesn't fit ICP"
  },
  hard_no: {
    label: 'Hard No',
    color: 'bg-red-200 text-red-900 border-red-300',
    description: 'Explicit rejection - do not contact'
  }
};

const STYLE_LABELS: Record<string, { label: string; description: string }> = {
  direct: { label: 'Direct', description: 'Most assertive approach' },
  soft: { label: 'Soft', description: 'Lower pressure' },
  question_first: { label: 'Question First', description: 'Leads with a question' }
};

export default function ResponseGenerator({ prospect, onClose }: ResponseGeneratorProps) {
  const [prospectResponse, setProspectResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedClassification, setSelectedClassification] = useState<ResponseClassification | null>(null);

  const segment = prospect.icpScoreBreakdown?.segment || 'merchant';

  const handleGenerate = useCallback(async () => {
    if (!prospectResponse.trim()) {
      setError('Please enter the prospect\'s response');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/responses/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect,
          prospectResponse: prospectResponse.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate response');
      }

      const data: GeneratedResponse = await response.json();
      setResult(data);
      setSelectedClassification(data.classification);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  }, [prospect, prospectResponse]);

  const handleRegenerate = useCallback(async () => {
    // Regenerate with the same or overridden classification
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/responses/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect,
          prospectResponse: prospectResponse.trim(),
          overrideClassification: selectedClassification !== result?.classification ? selectedClassification : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate response');
      }

      const data: GeneratedResponse = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  }, [prospect, prospectResponse, selectedClassification, result?.classification]);

  const copyToClipboard = useCallback(async (text: string, index: number, style: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);

    // Log the interaction
    if (result) {
      try {
        await fetch('/api/responses/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prospectId: prospect.id,
            prospectResponse,
            classification: selectedClassification || result.classification,
            classificationOverridden: selectedClassification !== result.classification,
            originalClassification: result.classification,
            generatedResponses: result.responses,
            selectedResponse: text,
            selectedStyle: style
          })
        });
      } catch (err) {
        console.error('Failed to log response interaction:', err);
      }
    }
  }, [prospect.id, prospectResponse, result, selectedClassification]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Response Generator</h2>
            <p className="text-sm text-gray-500">Generate reply options for prospect responses</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Prospect Context */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-4">
              {prospect.profilePicUrl ? (
                <img
                  src={prospect.profilePicUrl}
                  alt={prospect.fullName}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium">
                  {prospect.firstName?.[0] || prospect.fullName?.[0] || '?'}
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{prospect.fullName}</h3>
                <p className="text-sm text-gray-600">{prospect.jobTitle} at {prospect.companyName}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  segment === 'agency' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {segment.charAt(0).toUpperCase() + segment.slice(1)}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  prospect.icpScore >= 70 ? 'bg-emerald-100 text-emerald-700' :
                  prospect.icpScore >= 40 ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  ICP: {prospect.icpScore}
                </span>
              </div>
            </div>

            {/* Previous messages context */}
            {prospect.messages && prospect.messages.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Previous outreach:</p>
                <div className="space-y-1">
                  {prospect.messages.slice(-2).map((msg, idx) => (
                    <p key={idx} className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                      <span className="font-medium">{msg.messageType.replace(/_/g, ' ')}:</span> {msg.content.substring(0, 100)}...
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Prospect Response Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prospect's Response
            </label>
            <textarea
              value={prospectResponse}
              onChange={(e) => setProspectResponse(e.target.value)}
              placeholder="Paste the prospect's LinkedIn message here..."
              className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prospectResponse.trim()}
              className="mt-3 w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing & Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Responses
                </>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-6">
              {/* Classification */}
              <div className="p-4 bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Classification</h4>
                  {result.shouldEscalate && (
                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      ESCALATE
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {(Object.keys(CLASSIFICATION_LABELS) as ResponseClassification[]).map((cls) => (
                    <button
                      key={cls}
                      onClick={() => setSelectedClassification(cls)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                        selectedClassification === cls
                          ? CLASSIFICATION_LABELS[cls].color + ' ring-2 ring-offset-1 ring-gray-400'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {CLASSIFICATION_LABELS[cls].label}
                    </button>
                  ))}
                </div>

                {selectedClassification && (
                  <div className={`p-3 rounded-lg border ${CLASSIFICATION_LABELS[selectedClassification].color}`}>
                    <p className="text-sm">
                      <span className="font-medium">{CLASSIFICATION_LABELS[selectedClassification].label}:</span>{' '}
                      {CLASSIFICATION_LABELS[selectedClassification].description}
                    </p>
                    {result.classificationConfidence && (
                      <p className="text-xs mt-1 opacity-75">
                        Confidence: {result.classificationConfidence}%
                      </p>
                    )}
                  </div>
                )}

                {selectedClassification !== result.classification && (
                  <button
                    onClick={handleRegenerate}
                    disabled={isGenerating}
                    className="mt-3 px-4 py-2 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                  >
                    Regenerate with {CLASSIFICATION_LABELS[selectedClassification!].label}
                  </button>
                )}

                {result.shouldEscalate && result.escalationReason && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                      <span className="font-medium">Escalation reason:</span> {result.escalationReason}
                    </p>
                    <button className="mt-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
                      Notify Isaac
                    </button>
                  </div>
                )}
              </div>

              {/* Recommended Action */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-1">Recommended Action</h4>
                <p className="text-sm text-blue-800">{result.recommendedAction}</p>
              </div>

              {/* Response Options */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Response Options</h4>
                <div className="space-y-3">
                  {result.responses.map((response, index) => (
                    <div
                      key={index}
                      className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          response.style === 'direct' ? 'bg-blue-100 text-blue-700' :
                          response.style === 'soft' ? 'bg-green-100 text-green-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {STYLE_LABELS[response.style].label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {STYLE_LABELS[response.style].description}
                        </span>
                      </div>
                      <p className="text-gray-800 mb-3 whitespace-pre-wrap">{response.content}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          {response.content.length} characters
                        </span>
                        <button
                          onClick={() => copyToClipboard(response.content, index, response.style)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            copiedIndex === index
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {copiedIndex === index ? (
                            <>
                              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
