'use client';

import { useState } from 'react';
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

// Get ICP border color based on score
function getICPBorderColor(score: number): string {
  if (score >= 70) return 'border-l-green-500';
  if (score >= 40) return 'border-l-amber-500';
  return 'border-l-gray-400';
}

// Get ICP badge styling based on score
function getICPBadgeStyle(score: number): string {
  if (score >= 70) return 'bg-green-500 text-white';
  if (score >= 40) return 'bg-amber-500 text-white';
  return 'bg-gray-400 text-white';
}

export function ProspectCard({ prospect, onClick, isSelected, onSelect, selectionMode }: ProspectCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const status = prospect.pipeline?.status || 'not_contacted';
  const hasMessages = prospect.messages && prospect.messages.length > 0;
  const icpScore = prospect.icpScore || 0;
  const breakdown = prospect.icpScoreBreakdown;

  // Only show status badge if contacted (not the default "Not Contacted")
  const showStatusBadge = status !== 'not_contacted';

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(prospect.id, !isSelected);
  };

  const handleMouseEnter = () => setShowBreakdown(true);
  const handleMouseLeave = () => setShowBreakdown(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`bg-white rounded-lg border-l-4 border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer relative ${
        getICPBorderColor(icpScore)
      } ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
    >
      {/* TOP ROW: ICP Score + Status Badge */}
      <div className="flex items-center justify-between mb-3">
        {/* ICP Score - Large and prominent */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-lg ${getICPBadgeStyle(icpScore)}`}>
          <span>{icpScore}</span>
          <span className="text-xs font-normal opacity-90">ICP</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge - Only show if contacted */}
          {showStatusBadge && (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
              {statusLabels[status]}
            </span>
          )}

          {/* Selection Checkbox */}
          {selectionMode && (
            <div className="flex-shrink-0" onClick={handleCheckboxClick}>
              <input
                type="checkbox"
                checked={isSelected || false}
                onChange={() => {}}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>

      {/* MIDDLE ROW: Photo + Name/Title/Company */}
      <div className="flex items-start gap-3">
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

        {/* Name, Title, Company */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {prospect.fullName}
          </h3>
          <p className="text-sm text-gray-600 truncate">
            {prospect.jobTitle || prospect.headline || 'No title'}
          </p>
          {prospect.companyName && (
            <p className="text-sm text-gray-500 truncate">
              {prospect.companyName}
            </p>
          )}
        </div>
      </div>

      {/* BOTTOM ROW: Segment + Icons */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Segment Badge */}
          {breakdown?.segment && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              breakdown.segment === 'agency'
                ? 'bg-blue-100 text-blue-700'
                : breakdown.segment === 'merchant'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {breakdown.segment === 'agency'
                ? 'Agency'
                : breakdown.segment === 'merchant'
                ? 'Merchant'
                : 'Freelancer'}
            </span>
          )}

          {/* Industry (truncated) */}
          {prospect.companyIndustry && (
            <span className="text-xs text-gray-500 truncate max-w-[120px]">
              {prospect.companyIndustry}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Messages Indicator */}
          {hasMessages && (
            <span
              className="inline-flex items-center text-green-600 hover:text-green-700"
              title="Messages generated"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </span>
          )}

          {/* LinkedIn Icon */}
          <a
            href={prospect.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 hover:text-blue-800"
            title="Open LinkedIn profile"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
        </div>
      </div>

      {/* ICP Breakdown Tooltip on Hover */}
      {showBreakdown && breakdown && (
        <div className="absolute left-full top-0 ml-2 z-50 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg min-w-[180px]">
          <div className="font-semibold mb-2 text-sm">ICP Breakdown</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Title Authority:</span>
              <span className="font-medium">{breakdown.titleAuthority} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Company Signals:</span>
              <span className="font-medium">{breakdown.companySignals} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Company Size:</span>
              <span className="font-medium">{breakdown.companySize} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Product Category:</span>
              <span className="font-medium">{breakdown.productCategory} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Profile Complete:</span>
              <span className="font-medium">{breakdown.profileCompleteness} pts</span>
            </div>
            <div className="border-t border-gray-700 mt-2 pt-2 flex justify-between font-semibold">
              <span>Total:</span>
              <span>{breakdown.total} pts</span>
            </div>
          </div>
          {/* Arrow pointing left */}
          <div className="absolute right-full top-4 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-gray-900"></div>
        </div>
      )}
    </div>
  );
}
