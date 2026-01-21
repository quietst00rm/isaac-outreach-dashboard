'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ProspectWithPipeline, PipelineStatus, GeneratedMessage } from '@/types';

interface ProspectDetailProps {
  prospect: ProspectWithPipeline;
  onClose: () => void;
  onStatusChange: (status: PipelineStatus) => void;
  onGenerateMessages: () => void;
  isGenerating?: boolean;
}

const statusOptions: { value: PipelineStatus; label: string }[] = [
  { value: 'not_contacted', label: 'Not Contacted' },
  { value: 'visited', label: 'Profile Visited' },
  { value: 'connection_sent', label: 'Connection Sent' },
  { value: 'connected', label: 'Connected' },
  { value: 'message_sent', label: 'Message Sent' },
  { value: 'responded', label: 'Responded' },
  { value: 'call_booked', label: 'Call Booked' },
  { value: 'closed_won', label: 'Closed - Won' },
  { value: 'closed_lost', label: 'Closed - Lost' },
];

const messageTypeLabels: Record<string, string> = {
  connection_request: 'Connection Request',
  follow_up_1: 'Follow-up #1',
  follow_up_2: 'Follow-up #2',
  comment: 'Comment',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ProspectDetail({
  prospect,
  onClose,
  onStatusChange,
  onGenerateMessages,
  isGenerating = false,
}: ProspectDetailProps) {
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [showICPBreakdown, setShowICPBreakdown] = useState(false);
  const status = prospect.pipeline?.status || 'not_contacted';

  const copyToClipboard = async (text: string, messageId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedMessage(messageId);
    setTimeout(() => setCopiedMessage(null), 2000);
  };

  const groupedMessages = (prospect.messages || []).reduce((acc, msg) => {
    if (!acc[msg.messageType]) {
      acc[msg.messageType] = [];
    }
    acc[msg.messageType].push(msg);
    return acc;
  }, {} as Record<string, GeneratedMessage[]>);

  const icpBreakdown = prospect.icpScoreBreakdown;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with Profile Image */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start gap-4">
            {/* Profile Image */}
            <div className="flex-shrink-0">
              {prospect.profilePicUrl ? (
                <Image
                  src={prospect.profilePicUrl}
                  alt={prospect.fullName}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                  unoptimized
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl border-2 border-gray-200">
                  {getInitials(prospect.fullName)}
                </div>
              )}
            </div>

            {/* Name and Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900">{prospect.fullName}</h2>
              <p className="text-gray-600 mt-1">{prospect.headline || prospect.jobTitle}</p>
              {prospect.companyName && (
                <p className="text-gray-500 text-sm mt-1">
                  {prospect.companyName}
                  {prospect.companyIndustry && ` \u00b7 ${prospect.companyIndustry}`}
                </p>
              )}
              {prospect.location && (
                <p className="text-gray-400 text-sm mt-1 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {prospect.location}
                </p>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Profile Info */}
            <div className="space-y-6">
              {/* Status & Actions */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Pipeline Status</h3>
                <select
                  value={status}
                  onChange={(e) => onStatusChange(e.target.value as PipelineStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <div className="mt-3 flex space-x-2">
                  <a
                    href={prospect.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    View Profile
                  </a>
                </div>
              </div>

              {/* ICP Score with Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">ICP Score</h3>
                  <button
                    onClick={() => setShowICPBreakdown(!showICPBreakdown)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {showICPBreakdown ? 'Hide details' : 'Show details'}
                  </button>
                </div>
                <div className="flex items-center">
                  <div className="flex-1 bg-gray-200 rounded-full h-3 mr-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        prospect.icpScore >= 70 ? 'bg-green-500' :
                        prospect.icpScore >= 40 ? 'bg-yellow-500' :
                        'bg-gray-400'
                      }`}
                      style={{ width: `${prospect.icpScore}%` }}
                    />
                  </div>
                  <span className="text-lg font-semibold">{prospect.icpScore}</span>
                </div>

                {/* ICP Breakdown */}
                {showICPBreakdown && icpBreakdown && (
                  <div className="mt-4 space-y-2 text-sm">
                    {/* Segment Badge */}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Segment</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        icpBreakdown.segment === 'agency' ? 'bg-purple-100 text-purple-700' :
                        icpBreakdown.segment === 'merchant' ? 'bg-blue-100 text-blue-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {icpBreakdown.segment === 'agency' ? 'Agency' :
                         icpBreakdown.segment === 'merchant' ? 'Merchant' : 'Freelancer'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Title Authority</span>
                      <span className={`font-medium ${icpBreakdown.titleAuthority > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        +{icpBreakdown.titleAuthority} pts
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Company Signals</span>
                      <span className={`font-medium ${icpBreakdown.companySignals > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        +{icpBreakdown.companySignals} pts
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Company Size Fit</span>
                      <span className={`font-medium ${
                        icpBreakdown.companySize > 0 ? 'text-green-600' :
                        icpBreakdown.companySize < 0 ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        {icpBreakdown.companySize >= 0 ? '+' : ''}{icpBreakdown.companySize} pts
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Product Category</span>
                      <span className={`font-medium ${icpBreakdown.productCategory > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        +{icpBreakdown.productCategory} pts
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Profile Completeness</span>
                      <span className={`font-medium ${icpBreakdown.profileCompleteness > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        +{icpBreakdown.profileCompleteness} pts
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between items-center">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="font-bold text-gray-900">{icpBreakdown.total} pts</span>
                    </div>
                  </div>
                )}
              </div>

              {/* About */}
              {prospect.aboutSummary && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">About</h3>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap">
                    {prospect.aboutSummary}
                  </p>
                </div>
              )}

              {/* Career History */}
              {prospect.careerHistory && prospect.careerHistory.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Career History</h3>
                  <div className="space-y-3">
                    {prospect.careerHistory.map((exp, index) => (
                      <div key={index} className="border-l-2 border-gray-200 pl-4">
                        <p className="font-medium text-gray-900">{exp.title}</p>
                        <p className="text-sm text-gray-600">{exp.companyName}</p>
                        {exp.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {exp.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Messages */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Generated Messages</h3>
                <button
                  onClick={onGenerateMessages}
                  disabled={isGenerating}
                  className="inline-flex items-center px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate
                    </>
                  )}
                </button>
              </div>

              {Object.keys(groupedMessages).length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-6 text-center">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p className="text-gray-600">No messages generated yet.</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Click &quot;Generate&quot; to create personalized outreach messages.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {['connection_request', 'follow_up_1', 'follow_up_2', 'comment'].map((type) => {
                    const messages = groupedMessages[type];
                    if (!messages || messages.length === 0) return null;

                    return (
                      <div key={type} className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">
                          {messageTypeLabels[type]}
                        </h4>
                        {messages.map((message) => (
                          <div key={message.id} className="relative">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap pr-8">
                              {message.content}
                            </p>
                            <button
                              onClick={() => copyToClipboard(message.content, message.id)}
                              className="absolute top-0 right-0 p-1 text-gray-400 hover:text-gray-600"
                              title="Copy to clipboard"
                            >
                              {copiedMessage === message.id ? (
                                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
