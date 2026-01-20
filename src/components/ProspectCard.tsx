'use client';

import Image from 'next/image';
import type { ProspectWithPipeline, PipelineStatus } from '@/types';

interface ProspectCardProps {
  prospect: ProspectWithPipeline;
  onClick: () => void;
}

const statusColors: Record<PipelineStatus, string> = {
  not_contacted: 'bg-gray-100 text-gray-700',
  visited: 'bg-blue-100 text-blue-700',
  connection_sent: 'bg-yellow-100 text-yellow-700',
  connected: 'bg-green-100 text-green-700',
  message_sent: 'bg-purple-100 text-purple-700',
  responded: 'bg-indigo-100 text-indigo-700',
  call_booked: 'bg-pink-100 text-pink-700',
  closed_won: 'bg-emerald-100 text-emerald-700',
  closed_lost: 'bg-red-100 text-red-700',
};

const statusLabels: Record<PipelineStatus, string> = {
  not_contacted: 'Not Contacted',
  visited: 'Visited',
  connection_sent: 'Request Sent',
  connected: 'Connected',
  message_sent: 'Message Sent',
  responded: 'Responded',
  call_booked: 'Call Booked',
  closed_won: 'Won',
  closed_lost: 'Lost',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ProspectCard({ prospect, onClick }: ProspectCardProps) {
  const status = prospect.pipeline?.status || 'not_contacted';
  const hasMessages = prospect.messages && prospect.messages.length > 0;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start gap-3 mb-3">
        {/* Profile Image */}
        <div className="flex-shrink-0">
          {prospect.profilePicUrl ? (
            <Image
              src={prospect.profilePicUrl}
              alt={prospect.fullName}
              width={48}
              height={48}
              className="w-12 h-12 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
              {getInitials(prospect.fullName)}
            </div>
          )}
        </div>

        {/* Name and Title */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {prospect.fullName}
          </h3>
          <p className="text-sm text-gray-500 truncate">
            {prospect.jobTitle || prospect.headline || 'No title'}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex-shrink-0">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
            {statusLabels[status]}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {prospect.companyName && (
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="truncate">{prospect.companyName}</span>
          </div>
        )}

        {prospect.companyIndustry && (
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span className="truncate">{prospect.companyIndustry}</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            prospect.icpScore >= 70 ? 'bg-green-100 text-green-700' :
            prospect.icpScore >= 40 ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            ICP: {prospect.icpScore}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {hasMessages && (
            <span className="inline-flex items-center text-xs text-green-600">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Messages
            </span>
          )}

          <a
            href={prospect.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 hover:text-blue-800"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
