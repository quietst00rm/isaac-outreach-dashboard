'use client';

import { useState } from 'react';
import type { Prospect, ICPScoreBreakdown } from '@/types';
import { calculateICPScoreWithBreakdown } from '@/lib/import';

interface AddProspectModalProps {
  onClose: () => void;
  onAdd: (prospect: Partial<Prospect>) => void;
}

export function AddProspectModal({ onClose, onAdd }: AddProspectModalProps) {
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('');
  const [headline, setHeadline] = useState('');
  const [aboutSummary, setAboutSummary] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!linkedinUrl) {
      setError('LinkedIn URL is required');
      return;
    }

    if (!firstName && !lastName) {
      setError('At least first name or last name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Normalize LinkedIn URL
      let normalizedUrl = linkedinUrl.toLowerCase().trim();
      if (!normalizedUrl.startsWith('http')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      normalizedUrl = normalizedUrl.replace('http://', 'https://');
      normalizedUrl = normalizedUrl.replace(/\/$/, '');
      if (normalizedUrl.includes('linkedin.com') && !normalizedUrl.includes('www.linkedin.com')) {
        normalizedUrl = normalizedUrl.replace('linkedin.com', 'www.linkedin.com');
      }

      const fullName = `${firstName} ${lastName}`.trim();

      // Create prospect object
      const prospect: Partial<Prospect> = {
        firstName,
        lastName,
        fullName,
        linkedinUrl: normalizedUrl,
        profilePicUrl: profilePicUrl || undefined,
        headline,
        aboutSummary,
        companyName,
        companyIndustry,
        jobTitle,
        careerHistory: [],
        recentPosts: [],
      };

      // Calculate ICP score
      const icpBreakdown = calculateICPScoreWithBreakdown(prospect);
      prospect.icpScore = icpBreakdown.total;
      prospect.icpScoreBreakdown = icpBreakdown;

      onAdd(prospect);
      onClose();
    } catch (err) {
      setError('Failed to add prospect');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Add Prospect</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* LinkedIn URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LinkedIn URL *
              </label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/username"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Name Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Job Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="CEO, Founder, Director..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Company Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Inc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  value={companyIndustry}
                  onChange={(e) => setCompanyIndustry(e.target.value)}
                  placeholder="E-commerce, Retail..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Headline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Headline
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Building the future of..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* About */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                About / Summary
              </label>
              <textarea
                value={aboutSummary}
                onChange={(e) => setAboutSummary(e.target.value)}
                placeholder="Background, experience, interests..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Profile Picture URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Profile Picture URL (optional)
              </label>
              <input
                type="url"
                value={profilePicUrl}
                onChange={(e) => setProfilePicUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add Prospect'}
          </button>
        </div>
      </div>
    </div>
  );
}
