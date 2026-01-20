'use client';

import Image from 'next/image';
import type { ProspectWithPipeline, PipelineStatus } from '@/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface PipelineBoardProps {
  prospects: ProspectWithPipeline[];
  onProspectClick: (prospect: ProspectWithPipeline) => void;
  onStatusChange: (prospectId: string, newStatus: PipelineStatus) => void;
}

const pipelineStages: { status: PipelineStatus; label: string; color: string }[] = [
  { status: 'not_contacted', label: 'Not Contacted', color: 'bg-gray-100' },
  { status: 'visited', label: 'Visited', color: 'bg-blue-100' },
  { status: 'connection_sent', label: 'Request Sent', color: 'bg-yellow-100' },
  { status: 'connected', label: 'Connected', color: 'bg-green-100' },
  { status: 'message_sent', label: 'Message Sent', color: 'bg-purple-100' },
  { status: 'responded', label: 'Responded', color: 'bg-indigo-100' },
  { status: 'call_booked', label: 'Call Booked', color: 'bg-pink-100' },
];

export function PipelineBoard({ prospects, onProspectClick, onStatusChange }: PipelineBoardProps) {
  const groupedProspects = pipelineStages.reduce((acc, stage) => {
    acc[stage.status] = prospects.filter(
      (p) => (p.pipeline?.status || 'not_contacted') === stage.status
    );
    return acc;
  }, {} as Record<PipelineStatus, ProspectWithPipeline[]>);

  const handleDragStart = (e: React.DragEvent, prospectId: string) => {
    e.dataTransfer.setData('prospectId', prospectId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: PipelineStatus) => {
    e.preventDefault();
    const prospectId = e.dataTransfer.getData('prospectId');
    if (prospectId) {
      onStatusChange(prospectId, newStatus);
    }
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-max p-4">
        {pipelineStages.map((stage) => (
          <div
            key={stage.status}
            className="w-72 flex-shrink-0"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.status)}
          >
            {/* Column Header */}
            <div className={`${stage.color} rounded-t-lg px-4 py-3 flex items-center justify-between`}>
              <h3 className="font-semibold text-gray-900">{stage.label}</h3>
              <span className="text-sm text-gray-600 bg-white/50 px-2 py-0.5 rounded-full">
                {groupedProspects[stage.status]?.length || 0}
              </span>
            </div>

            {/* Column Content */}
            <div className="bg-gray-50 rounded-b-lg p-2 min-h-[400px] max-h-[600px] overflow-y-auto">
              <div className="space-y-2">
                {groupedProspects[stage.status]?.map((prospect) => (
                  <div
                    key={prospect.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, prospect.id)}
                    onClick={() => onProspectClick(prospect)}
                    className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {/* Profile Image */}
                      {prospect.profilePicUrl ? (
                        <Image
                          src={prospect.profilePicUrl}
                          alt={prospect.fullName}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          unoptimized
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
                          {getInitials(prospect.fullName)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate text-sm">
                          {prospect.fullName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {prospect.jobTitle || prospect.companyName || 'No title'}
                        </p>
                      </div>
                    </div>
                    {prospect.companyName && prospect.jobTitle && (
                      <p className="text-xs text-gray-400 truncate mb-2">
                        {prospect.companyName}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        prospect.icpScore >= 70 ? 'bg-green-100 text-green-700' :
                        prospect.icpScore >= 40 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        ICP: {prospect.icpScore}
                      </span>
                      {prospect.messages && prospect.messages.length > 0 && (
                        <span className="text-xs text-green-600 flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                          </svg>
                          Msg
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {(!groupedProspects[stage.status] || groupedProspects[stage.status].length === 0) && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Drop prospects here
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
