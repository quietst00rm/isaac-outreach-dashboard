'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ProspectCard, ProspectDetail, ImportModal, PipelineBoard, AddProspectModal, BulkUrlImportModal } from '@/components';
import type { ProspectWithPipeline, PipelineStatus, Prospect, PipelineRecord, FilterOptions } from '@/types';
import {
  getProspects,
  bulkImportProspects,
  updatePipelineStatus,
  saveGeneratedMessage,
  transformDbToApp,
  isSupabaseConfigured
} from '@/lib/supabase';

type ViewMode = 'grid' | 'pipeline';

export default function Dashboard() {
  const [prospects, setProspects] = useState<ProspectWithPipeline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [useSupabase, setUseSupabase] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<ProspectWithPipeline | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkUrlModal, setShowBulkUrlModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isGenerating, setIsGenerating] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    search: '',
  });

  // Check for Supabase and load data on mount
  useEffect(() => {
    const loadData = async () => {
      const supabaseConfigured = isSupabaseConfigured();
      setUseSupabase(supabaseConfigured);

      if (supabaseConfigured) {
        try {
          const data = await getProspects();
          const transformed = transformDbToApp(data) as ProspectWithPipeline[];
          setProspects(transformed);
        } catch (error) {
          console.error('Failed to load from Supabase:', error);
        }
      }

      setIsLoading(false);
    };

    loadData();
  }, []);

  // Filter and search prospects
  const filteredProspects = useMemo(() => {
    return prospects.filter((prospect) => {
      // Status filter
      if (filters.status && filters.status !== 'all') {
        const prospectStatus = prospect.pipeline?.status || 'not_contacted';
        if (prospectStatus !== filters.status) return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesName = prospect.fullName.toLowerCase().includes(searchLower);
        const matchesCompany = prospect.companyName?.toLowerCase().includes(searchLower);
        const matchesTitle = prospect.jobTitle?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesCompany && !matchesTitle) return false;
      }

      return true;
    });
  }, [prospects, filters]);

  // Stats
  const stats = useMemo(() => {
    const total = prospects.length;
    const connected = prospects.filter(p =>
      ['connected', 'message_sent', 'responded', 'call_booked'].includes(p.pipeline?.status || '')
    ).length;
    const withMessages = prospects.filter(p => p.messages && p.messages.length > 0).length;
    const highICP = prospects.filter(p => p.icpScore >= 70).length;

    return { total, connected, withMessages, highICP };
  }, [prospects]);

  const handleImport = async (
    importedProspects: Partial<Prospect>[],
    pipelineData: Map<string, Partial<PipelineRecord>>
  ) => {
    // If Supabase is configured, save to database
    if (useSupabase) {
      try {
        const pipelineMap = new Map<string, { status?: string; notes?: string }>();
        for (const [url, data] of pipelineData.entries()) {
          pipelineMap.set(url, {
            status: data.status,
            notes: data.notes
          });
        }

        await bulkImportProspects(
          importedProspects.map(p => ({
            firstName: p.firstName || '',
            lastName: p.lastName || '',
            fullName: p.fullName || '',
            linkedinUrl: p.linkedinUrl || '',
            profilePicUrl: p.profilePicUrl,
            headline: p.headline,
            aboutSummary: p.aboutSummary,
            companyName: p.companyName,
            companyIndustry: p.companyIndustry,
            companySize: p.companySize,
            jobTitle: p.jobTitle,
            location: p.location,
            careerHistory: p.careerHistory,
            recentPosts: p.recentPosts,
            icpScore: p.icpScore,
            icpScoreBreakdown: p.icpScoreBreakdown,
            totalExperienceYears: p.totalExperienceYears,
            topSkills: p.topSkills
          })),
          pipelineMap
        );

        // Reload from database to get proper IDs
        const data = await getProspects();
        const transformed = transformDbToApp(data) as ProspectWithPipeline[];
        setProspects(transformed);
      } catch (error) {
        console.error('Failed to import to Supabase:', error);
        alert('Failed to save to database. Data will be stored locally only.');
        // Fall back to local storage
        createLocalProspects(importedProspects, pipelineData);
      }
    } else {
      // Store locally only
      createLocalProspects(importedProspects, pipelineData);
    }

    setShowImportModal(false);
  };

  const createLocalProspects = (
    importedProspects: Partial<Prospect>[],
    pipelineData: Map<string, Partial<PipelineRecord>>
  ) => {
    const newProspects: ProspectWithPipeline[] = importedProspects.map((p, index) => {
      const linkedinUrl = p.linkedinUrl || '';
      const pipeline = pipelineData.get(linkedinUrl);

      return {
        id: `prospect-${Date.now()}-${index}`,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        fullName: p.fullName || '',
        linkedinUrl: linkedinUrl,
        profilePicUrl: p.profilePicUrl,
        headline: p.headline,
        aboutSummary: p.aboutSummary,
        companyName: p.companyName,
        companyIndustry: p.companyIndustry,
        companySize: p.companySize,
        jobTitle: p.jobTitle,
        location: p.location,
        careerHistory: p.careerHistory || [],
        recentPosts: p.recentPosts || [],
        icpScore: p.icpScore || 0,
        icpScoreBreakdown: p.icpScoreBreakdown,
        totalExperienceYears: p.totalExperienceYears,
        topSkills: p.topSkills,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pipeline: pipeline ? {
          id: `pipeline-${Date.now()}-${index}`,
          prospectId: `prospect-${Date.now()}-${index}`,
          status: pipeline.status || 'not_contacted',
          visitedAt: pipeline.visitedAt,
          connectionSentAt: pipeline.connectionSentAt,
          connectionAcceptedAt: pipeline.connectionAcceptedAt,
          messageSentAt: pipeline.messageSentAt,
          notes: pipeline.notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } : undefined,
        messages: [],
      };
    });

    setProspects(newProspects);
  };

  const handleAddProspect = async (prospect: Partial<Prospect>) => {
    const newProspect: ProspectWithPipeline = {
      id: `prospect-${Date.now()}`,
      firstName: prospect.firstName || '',
      lastName: prospect.lastName || '',
      fullName: prospect.fullName || '',
      linkedinUrl: prospect.linkedinUrl || '',
      profilePicUrl: prospect.profilePicUrl,
      headline: prospect.headline,
      aboutSummary: prospect.aboutSummary,
      companyName: prospect.companyName,
      companyIndustry: prospect.companyIndustry,
      companySize: prospect.companySize,
      jobTitle: prospect.jobTitle,
      location: prospect.location,
      careerHistory: prospect.careerHistory || [],
      recentPosts: prospect.recentPosts || [],
      icpScore: prospect.icpScore || 0,
      icpScoreBreakdown: prospect.icpScoreBreakdown,
      totalExperienceYears: prospect.totalExperienceYears,
      topSkills: prospect.topSkills,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pipeline: {
        id: `pipeline-${Date.now()}`,
        prospectId: `prospect-${Date.now()}`,
        status: 'not_contacted',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      messages: [],
    };

    // Save to Supabase if configured
    if (useSupabase) {
      try {
        const pipelineMap = new Map<string, { status?: string; notes?: string }>();
        pipelineMap.set(prospect.linkedinUrl || '', { status: 'not_contacted' });

        await bulkImportProspects([{
          firstName: prospect.firstName || '',
          lastName: prospect.lastName || '',
          fullName: prospect.fullName || '',
          linkedinUrl: prospect.linkedinUrl || '',
          profilePicUrl: prospect.profilePicUrl,
          headline: prospect.headline,
          aboutSummary: prospect.aboutSummary,
          companyName: prospect.companyName,
          companyIndustry: prospect.companyIndustry,
          companySize: prospect.companySize,
          jobTitle: prospect.jobTitle,
          location: prospect.location,
          careerHistory: prospect.careerHistory,
          recentPosts: prospect.recentPosts,
          icpScore: prospect.icpScore,
          icpScoreBreakdown: prospect.icpScoreBreakdown,
          totalExperienceYears: prospect.totalExperienceYears,
          topSkills: prospect.topSkills
        }], pipelineMap);

        // Reload from database
        const data = await getProspects();
        const transformed = transformDbToApp(data) as ProspectWithPipeline[];
        setProspects(transformed);
      } catch (error) {
        console.error('Failed to add to Supabase:', error);
        // Fall back to local
        setProspects(prev => [newProspect, ...prev]);
      }
    } else {
      setProspects(prev => [newProspect, ...prev]);
    }

    setShowAddModal(false);
  };

  const handleBulkUrlImport = async (importedProspects: Partial<Prospect>[]) => {
    // If Supabase is configured, save to database
    if (useSupabase) {
      try {
        const pipelineMap = new Map<string, { status?: string; notes?: string }>();
        for (const p of importedProspects) {
          if (p.linkedinUrl) {
            pipelineMap.set(p.linkedinUrl, { status: 'not_contacted' });
          }
        }

        await bulkImportProspects(
          importedProspects.map(p => ({
            firstName: p.firstName || '',
            lastName: p.lastName || '',
            fullName: p.fullName || '',
            linkedinUrl: p.linkedinUrl || '',
            profilePicUrl: p.profilePicUrl,
            headline: p.headline,
            aboutSummary: p.aboutSummary,
            companyName: p.companyName,
            companyIndustry: p.companyIndustry,
            companySize: p.companySize,
            jobTitle: p.jobTitle,
            location: p.location,
            careerHistory: p.careerHistory,
            recentPosts: p.recentPosts,
            icpScore: p.icpScore,
            icpScoreBreakdown: p.icpScoreBreakdown,
            totalExperienceYears: p.totalExperienceYears,
            topSkills: p.topSkills
          })),
          pipelineMap
        );

        // Reload from database to get proper IDs
        const data = await getProspects();
        const transformed = transformDbToApp(data) as ProspectWithPipeline[];
        setProspects(transformed);
      } catch (error) {
        console.error('Failed to import to Supabase:', error);
        alert('Failed to save to database. Data will be stored locally only.');
        // Fall back to local storage
        const emptyPipelineData = new Map<string, Partial<PipelineRecord>>();
        createLocalProspects(importedProspects, emptyPipelineData);
      }
    } else {
      // Store locally only
      const emptyPipelineData = new Map<string, Partial<PipelineRecord>>();
      createLocalProspects(importedProspects, emptyPipelineData);
    }

    setShowBulkUrlModal(false);
  };

  const handleStatusChange = async (prospectId: string, newStatus: PipelineStatus) => {
    // Update local state immediately for responsive UI
    setProspects((prev) =>
      prev.map((p) => {
        if (p.id === prospectId) {
          return {
            ...p,
            pipeline: {
              ...p.pipeline,
              id: p.pipeline?.id || `pipeline-${Date.now()}`,
              prospectId: p.id,
              status: newStatus,
              createdAt: p.pipeline?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          };
        }
        return p;
      })
    );

    // Also update selected prospect if it's the one being changed
    if (selectedProspect?.id === prospectId) {
      setSelectedProspect((prev) =>
        prev
          ? {
              ...prev,
              pipeline: {
                ...prev.pipeline,
                id: prev.pipeline?.id || `pipeline-${Date.now()}`,
                prospectId: prev.id,
                status: newStatus,
                createdAt: prev.pipeline?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }
          : null
      );
    }

    // Persist to Supabase if configured
    if (useSupabase) {
      try {
        await updatePipelineStatus(prospectId, { status: newStatus });
      } catch (error) {
        console.error('Failed to update status in Supabase:', error);
      }
    }
  };

  const handleGenerateMessages = async () => {
    if (!selectedProspect) return;

    setIsGenerating(true);

    try {
      const response = await fetch('/api/messages/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect: selectedProspect }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate messages');
      }

      const { messages } = await response.json();

      // Save to Supabase if configured
      if (useSupabase) {
        try {
          await saveGeneratedMessage(selectedProspect.id, 'connection_request', messages.connectionRequest);
          await saveGeneratedMessage(selectedProspect.id, 'follow_up_1', messages.followUp1);
          await saveGeneratedMessage(selectedProspect.id, 'follow_up_2', messages.followUp2);
        } catch (error) {
          console.error('Failed to save messages to Supabase:', error);
        }
      }

      // Update prospects with new messages
      const newMessages = [
        {
          id: `msg-${Date.now()}-1`,
          prospectId: selectedProspect.id,
          messageType: 'connection_request' as const,
          content: messages.connectionRequest,
          generatedAt: new Date().toISOString(),
          used: false,
        },
        {
          id: `msg-${Date.now()}-2`,
          prospectId: selectedProspect.id,
          messageType: 'follow_up_1' as const,
          content: messages.followUp1,
          generatedAt: new Date().toISOString(),
          used: false,
        },
        {
          id: `msg-${Date.now()}-3`,
          prospectId: selectedProspect.id,
          messageType: 'follow_up_2' as const,
          content: messages.followUp2,
          generatedAt: new Date().toISOString(),
          used: false,
        },
      ];

      setProspects((prev) =>
        prev.map((p) => {
          if (p.id === selectedProspect.id) {
            return {
              ...p,
              messages: [...(p.messages || []), ...newMessages],
            };
          }
          return p;
        })
      );

      // Update selected prospect
      setSelectedProspect((prev) =>
        prev
          ? {
              ...prev,
              messages: [...(prev.messages || []), ...newMessages],
            }
          : null
      );
    } catch (error) {
      console.error('Error generating messages:', error);
      alert('Failed to generate messages. Make sure your API key is configured.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-600">Loading prospects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                Isaac Outreach
              </h1>
              <span className="ml-3 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                Parcelis
              </span>
              {/* Database Status */}
              <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${
                useSupabase
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {useSupabase ? 'Synced' : 'Local Only'}
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Prospect
              </button>
              <button
                onClick={() => setShowBulkUrlModal(true)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                Import URLs
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Import Excel
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total Prospects</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-2xl font-bold text-green-600">{stats.connected}</p>
            <p className="text-sm text-gray-500">Connected</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-2xl font-bold text-purple-600">{stats.withMessages}</p>
            <p className="text-sm text-gray-500">Messages Ready</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-2xl font-bold text-blue-600">{stats.highICP}</p>
            <p className="text-sm text-gray-500">High ICP (70+)</p>
          </div>
        </div>

        {/* Filters and View Toggle */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, company, or title..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={filters.status || 'all'}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as PipelineStatus | 'all' })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="not_contacted">Not Contacted</option>
                <option value="visited">Visited</option>
                <option value="connection_sent">Request Sent</option>
                <option value="connected">Connected</option>
                <option value="message_sent">Message Sent</option>
                <option value="responded">Responded</option>
                <option value="call_booked">Call Booked</option>
              </select>
            </div>

            {/* View Toggle */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 text-sm font-medium ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('pipeline')}
                className={`px-4 py-2 text-sm font-medium ${
                  viewMode === 'pipeline'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {prospects.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Prospects Yet</h3>
            <p className="text-gray-600 mb-6">
              Import your LinkedIn prospects Excel file to get started.
            </p>
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Import Prospects
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProspects.map((prospect) => (
              <ProspectCard
                key={prospect.id}
                prospect={prospect}
                onClick={() => setSelectedProspect(prospect)}
              />
            ))}
            {filteredProspects.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                No prospects match your filters
              </div>
            )}
          </div>
        ) : (
          <PipelineBoard
            prospects={filteredProspects}
            onProspectClick={setSelectedProspect}
            onStatusChange={handleStatusChange}
          />
        )}
      </main>

      {/* Modals */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
        />
      )}

      {showAddModal && (
        <AddProspectModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddProspect}
        />
      )}

      {showBulkUrlModal && (
        <BulkUrlImportModal
          onClose={() => setShowBulkUrlModal(false)}
          onImport={handleBulkUrlImport}
          existingUrls={prospects.map(p => p.linkedinUrl)}
        />
      )}

      {selectedProspect && (
        <ProspectDetail
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onStatusChange={(status) => handleStatusChange(selectedProspect.id, status)}
          onGenerateMessages={handleGenerateMessages}
          isGenerating={isGenerating}
        />
      )}
    </div>
  );
}
