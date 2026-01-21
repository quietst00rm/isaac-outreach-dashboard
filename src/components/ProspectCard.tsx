'use client';

// ProspectCard - Compact card component for prospect display
import Image from 'next/image';
import type { ProspectWithPipeline, PipelineStatus } from '@/types';

interface ProspectCardProps {
  prospect: ProspectWithPipeline;
  onClick: () => void;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  selectionMode?: boolean;
}

const statusColors: Record<PipelineStatus, string> = {
  not_contacted: 'bg-gray-100 text-gray-600',
  visited: 'bg-blue-50 text-blue-600',
  connection_sent: 'bg-amber-50 text-amber-600',
  connected: 'bg-emerald-50 text-emerald-600',
  message_sent: 'bg-purple-50 text-purple-600',
  responded: 'bg-indigo-50 text-indigo-600',
  call_booked: 'bg-pink-50 text-pink-600',
  closed_won: 'bg-emerald-50 text-emerald-700',
  closed_lost: 'bg-red-50 text-red-600',
};

const statusLabels: Record<PipelineStatus, string> = {
  not_contacted: 'New',
  visited: 'Visited',
  connection_sent: 'Requested',
  connected: 'Connected',
  message_sent: 'Messaged',
  responded: 'Responded',
  call_booked: 'Call',
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

// Get ICP dot color based on score
function getICPDotColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-gray-400';
}

export function ProspectCard({ prospect, onClick, isSelected, onSelect, selectionMode }: ProspectCardProps) {
  const status = prospect.pipeline?.status || 'not_contacted';
  const hasMessages = prospect.messages && prospect.messages.length > 0;
  const icpScore = prospect.icpScore || 0;
  const breakdown = prospect.icpScoreBreakdown;
  const showStatusBadge = status !== 'not_contacted';

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(prospect.id, !isSelected);
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group ${
        isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''
      }`}
    >
      {/* Main content row */}
      <div className="flex items-start gap-3">
        {/* Selection Checkbox - shows on hover or selection mode */}
        {selectionMode && (
          <div className="flex-shrink-0 pt-0.5" onClick={handleCheckboxClick}>
            <input
              type="checkbox"
              checked={isSelected || false}
              onChange={() => {}}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        )}

        {/* Profile Image - smaller */}
        <div className="flex-shrink-0">
          {prospect.profilePicUrl ? (
            <Image
              src={prospect.profilePicUrl}
              alt={prospect.fullName}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-xs">
              {getInitials(prospect.fullName)}
            </div>
          )}
        </div>

        {/* Name, Title, Company - compact */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 text-sm truncate">
              {prospect.fullName}
            </h3>
            {/* Status badge - inline, only if contacted */}
            {showStatusBadge && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[status]}`}>
                {statusLabels[status]}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 truncate mt-0.5">
            {prospect.jobTitle || prospect.headline || 'No title'}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {prospect.companyName || 'No company'}
          </p>
        </div>
      </div>

      {/* Bottom row: Segment, Industry, ICP, Icons */}
      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Segment Badge - small and subtle */}
          {breakdown?.segment && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
              breakdown.segment === 'agency'
                ? 'bg-blue-50 text-blue-700'
                : breakdown.segment === 'merchant'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {breakdown.segment === 'agency'
                ? 'Agency'
                : breakdown.segment === 'merchant'
                ? 'Merchant'
                : 'Freelancer'}
            </span>
          )}

          {/* Industry - truncated, muted */}
          {prospect.companyIndustry && (
            <span className="text-[10px] text-gray-400 truncate max-w-[80px]">
              {prospect.companyIndustry}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Messages Indicator */}
          {hasMessages && (
            <span title="Messages ready">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </span>
          )}

          {/* ICP Score - compact with colored dot */}
          <div className="flex items-center gap-1" title={`ICP Score: ${icpScore}`}>
            <span className={`w-2 h-2 rounded-full ${getICPDotColor(icpScore)}`}></span>
            <span className="text-xs font-semibold text-gray-700">{icpScore}</span>
          </div>

          {/* LinkedIn Icon */}
          <a
            href={prospect.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-gray-400 hover:text-blue-600 transition-colors"
            title="Open LinkedIn"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
