'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ProspectCard, ProspectDetail, ImportModal, PipelineBoard, AddProspectModal, BulkUrlImportModal } from '@/components';
import type { ProspectWithPipeline, PipelineStatus, Prospect, PipelineRecord, FilterOptions, SegmentFilter } from '@/types';
import {
  getProspects,
  bulkImportProspects,
  updatePipelineStatus,
  saveGeneratedMessage,
  transformDbToApp,
  isSupabaseConfigured
} from '@/lib/supabase';

type ViewMode = 'grid' | 'pipeline';
type SortOption = 'icp_desc' | 'icp_asc' | 'name_asc' | 'recent';
type ICPRange = 'all' | 'high' | 'medium' | 'low';

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [prospects, setProspects] = useState<ProspectWithPipeline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [useSupabase, setUseSupabase] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<ProspectWithPipeline | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkUrlModal, setShowBulkUrlModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecalculatingICP, setIsRecalculatingICP] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('icp_desc');
  const [icpRange, setIcpRange] = useState<ICPRange>('all');
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    segment: 'all',
    search: '',
  });

  // Initialize filters from URL params
  useEffect(() => {
    const status = searchParams.get('status') as PipelineStatus | 'all' | null;
    const segment = searchParams.get('segment') as SegmentFilter | null;
    const sort = searchParams.get('sort') as SortOption | null;
    const icp = searchParams.get('icp') as ICPRange | null;
    const search = searchParams.get('search');

    if (status || segment || search) {
      setFilters(prev => ({
        ...prev,
        status: status || 'all',
        segment: segment || 'all',
        search: search || '',
      }));
    }
    if (sort) setSortBy(sort);
    if (icp) setIcpRange(icp);
  }, [searchParams]);

  // Update URL when filters change
  const updateUrlParams = useCallback((newFilters: FilterOptions, newSort: SortOption, newIcpRange: ICPRange) => {
    const params = new URLSearchParams();
    if (newFilters.status && newFilters.status !== 'all') params.set('status', newFilters.status);
    if (newFilters.segment && newFilters.segment !== 'all') params.set('segment', newFilters.segment);
    if (newFilters.search) params.set('search', newFilters.search);
    if (newSort !== 'icp_desc') params.set('sort', newSort);
    if (newIcpRange !== 'all') params.set('icp', newIcpRange);

    const queryString = params.toString();
    router.replace(queryString ? `?${queryString}` : '/', { scroll: false });
  }, [router]);

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

  // Filter, search, and sort prospects
  const filteredProspects = useMemo(() => {
    let result = prospects.filter((prospect) => {
      // Status filter
      if (filters.status && filters.status !== 'all') {
        const prospectStatus = prospect.pipeline?.status || 'not_contacted';
        if (prospectStatus !== filters.status) return false;
      }

      // Segment filter
      if (filters.segment && filters.segment !== 'all') {
        const prospectSegment = prospect.icpScoreBreakdown?.segment || 'merchant';
        if (prospectSegment !== filters.segment) return false;
      }

      // ICP Range filter
      if (icpRange !== 'all') {
        const score = prospect.icpScore || 0;
        if (icpRange === 'high' && score < 70) return false;
        if (icpRange === 'medium' && (score < 40 || score >= 70)) return false;
        if (icpRange === 'low' && score >= 40) return false;
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

    // Sort results
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'icp_desc':
          return (b.icpScore || 0) - (a.icpScore || 0);
        case 'icp_asc':
          return (a.icpScore || 0) - (b.icpScore || 0);
        case 'name_asc':
          return a.fullName.localeCompare(b.fullName);
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [prospects, filters, sortBy, icpRange]);

  // Stats
  const stats = useMemo(() => {
    const total = prospects.length;
    const connected = prospects.filter(p =>
      ['connected', 'message_sent', 'responded', 'call_booked'].includes(p.pipeline?.status || '')
    ).length;
    const withMessages = prospects.filter(p => p.messages && p.messages.length > 0).length;
    const highICP = prospects.filter(p => p.icpScore >= 70).length;
    const mediumICP = prospects.filter(p => p.icpScore >= 40 && p.icpScore < 70).length;
    const lowICP = prospects.filter(p => p.icpScore < 40).length;

    return { total, connected, withMessages, highICP, mediumICP, lowICP };
  }, [prospects]);

  // Helper to apply filters and update URL
  const applyFilter = useCallback((newFilters: Partial<FilterOptions>, newSort?: SortOption, newIcpRange?: ICPRange) => {
    const updatedFilters = { ...filters, ...newFilters };
    const updatedSort = newSort ?? sortBy;
    const updatedIcpRange = newIcpRange ?? icpRange;

    setFilters(updatedFilters);
    if (newSort) setSortBy(newSort);
    if (newIcpRange) setIcpRange(newIcpRange);

    updateUrlParams(updatedFilters, updatedSort, updatedIcpRange);
  }, [filters, sortBy, icpRange, updateUrlParams]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({ status: 'all', segment: 'all', search: '' });
    setSortBy('icp_desc');
    setIcpRange('all');
    router.replace('/', { scroll: false });
  }, [router]);

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

  const handleRecalculateICP = async () => {
    if (!useSupabase) {
      alert('ICP recalculation requires Supabase to be configured.');
      return;
    }

    if (!confirm('This will recalculate ICP scores for all prospects using the new algorithm. Continue?')) {
      return;
    }

    setIsRecalculatingICP(true);

    try {
      const response = await fetch('/api/prospects/recalculate-icp', {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to recalculate ICP scores');
      }

      alert(`Successfully recalculated ICP scores for ${result.updated} prospects.`);

      // Reload prospects to get updated scores
      const data = await getProspects();
      const transformed = transformDbToApp(data) as ProspectWithPipeline[];
      setProspects(transformed);

    } catch (error) {
      console.error('Error recalculating ICP scores:', error);
      alert('Failed to recalculate ICP scores. Check console for details.');
    } finally {
      setIsRecalculatingICP(false);
    }
  };

  // Export prospects to CSV
  const handleExport = async (exportAll: boolean = true) => {
    if (!useSupabase) {
      alert('Export requires Supabase to be configured.');
      return;
    }

    setIsExporting(true);

    try {
      // Build query params for filtered export
      const params = new URLSearchParams();
      if (!exportAll) {
        if (filters.status && filters.status !== 'all') params.set('status', filters.status);
        if (filters.segment && filters.segment !== 'all') params.set('segment', filters.segment);
        if (icpRange && icpRange !== 'all') params.set('icpRange', icpRange);
        if (filters.search) params.set('search', filters.search);
      }

      const queryString = params.toString();
      const url = `/api/prospects/export${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to export');
      }

      // Get the blob and trigger download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `isaac-outreach-export-${new Date().toISOString().split('T')[0]}.csv`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
      console.error('Error exporting prospects:', error);
      alert('Failed to export prospects. Check console for details.');
    } finally {
      setIsExporting(false);
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

  // Selection handlers
  const handleSelectProspect = (id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allIds = filteredProspects.map(p => p.id);
    setSelectedIds(new Set(allIds));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedIds(new Set());
    }
    setSelectionMode(!selectionMode);
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} prospect(s)? This action cannot be undone.`)) {
      return;
    }

    setIsBulkProcessing(true);

    try {
      if (useSupabase) {
        const response = await fetch('/api/prospects/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to delete prospects');
        }

        // Reload from database
        const data = await getProspects();
        const transformed = transformDbToApp(data) as ProspectWithPipeline[];
        setProspects(transformed);
      } else {
        // Local delete
        setProspects(prev => prev.filter(p => !selectedIds.has(p.id)));
      }

      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error('Error deleting prospects:', error);
      alert('Failed to delete prospects. Check console for details.');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Bulk status change handler
  const handleBulkStatusChange = async (newStatus: PipelineStatus) => {
    if (selectedIds.size === 0) return;

    setIsBulkProcessing(true);

    try {
      if (useSupabase) {
        const response = await fetch('/api/prospects/bulk-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(selectedIds), status: newStatus }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to update status');
        }

        // Reload from database
        const data = await getProspects();
        const transformed = transformDbToApp(data) as ProspectWithPipeline[];
        setProspects(transformed);
      } else {
        // Local update
        setProspects(prev => prev.map(p => {
          if (selectedIds.has(p.id)) {
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
        }));
      }

      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Check console for details.');
    } finally {
      setIsBulkProcessing(false);
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
      {/* Header - Simplified */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">Isaac Outreach</h1>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded">
                Parcelis
              </span>
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                useSupabase ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {useSupabase ? 'Synced' : 'Local'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Selection Mode - Icon only when not active */}
              <button
                onClick={toggleSelectionMode}
                className={`inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectionMode
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title={selectionMode ? 'Cancel selection' : 'Select prospects'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                {selectionMode && <span className="ml-1.5">Cancel</span>}
              </button>

              <button
                onClick={() => setShowBulkUrlModal(true)}
                className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                Import
              </button>

              <Link
                href="/engagement"
                className="inline-flex items-center px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-md hover:bg-orange-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Engage
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Stats Cards - Compact, clickable with toggle */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <button
            onClick={clearFilters}
            className="bg-white rounded-md px-3 py-2 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all text-left flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{stats.total}</p>
              <p className="text-[10px] text-gray-500">Total</p>
            </div>
          </button>
          <button
            onClick={() => applyFilter({ status: filters.status === 'connected' ? 'all' : 'connected', segment: 'all' })}
            className={`bg-white rounded-md px-3 py-2 border hover:shadow-sm transition-all text-left flex items-center gap-2 ${
              filters.status === 'connected' ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              filters.status === 'connected' ? 'bg-emerald-200' : 'bg-emerald-100'
            }`}>
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-emerald-600">{stats.connected}</p>
              <p className="text-[10px] text-gray-500">Connected</p>
            </div>
          </button>
          <button
            onClick={() => applyFilter({}, undefined, icpRange === 'high' ? 'all' : 'high')}
            className={`bg-white rounded-md px-3 py-2 border hover:shadow-sm transition-all text-left flex items-center gap-2 ${
              icpRange === 'high' ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              icpRange === 'high' ? 'bg-emerald-200' : 'bg-emerald-100'
            }`}>
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-emerald-600">{stats.highICP}</p>
              <p className="text-[10px] text-gray-500">High ICP</p>
            </div>
          </button>
          <button
            onClick={() => applyFilter({}, undefined, icpRange === 'medium' ? 'all' : 'medium')}
            className={`bg-white rounded-md px-3 py-2 border hover:shadow-sm transition-all text-left flex items-center gap-2 ${
              icpRange === 'medium' ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-300'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              icpRange === 'medium' ? 'bg-amber-200' : 'bg-amber-100'
            }`}>
              <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-amber-600">{stats.mediumICP}</p>
              <p className="text-[10px] text-gray-500">Medium ICP</p>
            </div>
          </button>
        </div>

        {/* Filters and View Toggle - Compact */}
        <div className="bg-white rounded-md border border-gray-200 p-2.5 mb-3">
          <div className="flex flex-col gap-2">
            {/* Row 1: Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search prospects..."
                value={filters.search}
                onChange={(e) => applyFilter({ search: e.target.value })}
                className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Row 2: Filters, Quick Pills, Sort, View Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Dropdowns - Compact */}
              <select
                value={filters.status || 'all'}
                onChange={(e) => applyFilter({ status: e.target.value as PipelineStatus | 'all' })}
                className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
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

              <select
                value={filters.segment || 'all'}
                onChange={(e) => applyFilter({ segment: e.target.value as SegmentFilter })}
                className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="all">All Segments</option>
                <option value="agency">Agency</option>
                <option value="merchant">Merchant</option>
                <option value="freelancer">Freelancer</option>
              </select>

              <select
                value={icpRange}
                onChange={(e) => applyFilter({}, undefined, e.target.value as ICPRange)}
                className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="all">All ICP</option>
                <option value="high">High (70+)</option>
                <option value="medium">Medium (40-69)</option>
                <option value="low">Low (&lt;40)</option>
              </select>

              {/* Separator */}
              <div className="h-4 w-px bg-gray-200 mx-1 hidden sm:block" />

              {/* Quick Filter Pills - Smaller */}
              <button
                onClick={() => applyFilter({}, undefined, icpRange === 'high' ? 'all' : 'high')}
                className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition-colors ${
                  icpRange === 'high'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                70+
              </button>
              <button
                onClick={() => applyFilter({ status: filters.status === 'not_contacted' ? 'all' : 'not_contacted' })}
                className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition-colors ${
                  filters.status === 'not_contacted'
                    ? 'bg-gray-700 text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                New
              </button>
              {(filters.status !== 'all' || filters.segment !== 'all' || icpRange !== 'all' || filters.search) && (
                <button
                  onClick={clearFilters}
                  className="px-2 py-0.5 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Clear
                </button>
              )}

              {/* Right side: Sort and View Toggle */}
              <div className="flex items-center gap-2 ml-auto">
                <select
                  value={sortBy}
                  onChange={(e) => applyFilter({}, e.target.value as SortOption)}
                  className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="icp_desc">ICP ↓</option>
                  <option value="icp_asc">ICP ↑</option>
                  <option value="name_asc">Name A-Z</option>
                  <option value="recent">Recent</option>
                </select>

                {/* View Toggle */}
                <div className="flex border border-gray-200 rounded-md overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-2 py-1 text-xs transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                    title="Grid view"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('pipeline')}
                    className={`px-2 py-1 text-xs transition-colors ${
                      viewMode === 'pipeline'
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                    title="Pipeline view"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Row 3: Showing count + Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                Showing {filteredProspects.length} of {prospects.length}
                {(filters.status !== 'all' || filters.segment !== 'all' || icpRange !== 'all' || filters.search) && (
                  <span className="ml-1 text-blue-600">(filtered)</span>
                )}
              </div>

              {useSupabase && (
                <div className="flex items-center gap-3">
                  {/* Export CSV Button */}
                  <button
                    onClick={() => handleExport(true)}
                    disabled={isExporting}
                    className="inline-flex items-center text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    title="Export all prospects to CSV"
                  >
                    {isExporting ? (
                      <>
                        <svg className="animate-spin w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Exporting...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export CSV
                      </>
                    )}
                  </button>

                  {/* Recalculate ICP Button */}
                  <button
                    onClick={handleRecalculateICP}
                    disabled={isRecalculatingICP}
                    className="inline-flex items-center text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    title="Recalculate ICP scores"
                  >
                    {isRecalculatingICP ? (
                      <>
                        <svg className="animate-spin w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Recalculating...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Recalculate ICP
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectionMode && (
          <div className="bg-gray-800 rounded-md p-3 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-white font-medium">
                {selectedIds.size} selected
              </span>
              <button
                onClick={handleSelectAll}
                className="text-sm text-gray-300 hover:text-white"
              >
                Select All ({filteredProspects.length})
              </button>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleDeselectAll}
                  className="text-sm text-gray-300 hover:text-white"
                >
                  Deselect All
                </button>
              )}
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3">
                {/* Status Change Dropdown */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkStatusChange(e.target.value as PipelineStatus);
                      e.target.value = '';
                    }
                  }}
                  disabled={isBulkProcessing}
                  className="px-3 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                  defaultValue=""
                >
                  <option value="" disabled>Change Status</option>
                  <option value="not_contacted">Not Contacted</option>
                  <option value="visited">Visited</option>
                  <option value="connection_sent">Request Sent</option>
                  <option value="connected">Connected</option>
                  <option value="message_sent">Message Sent</option>
                  <option value="responded">Responded</option>
                  <option value="call_booked">Call Booked</option>
                  <option value="closed_won">Won</option>
                  <option value="closed_lost">Lost</option>
                </select>

                {/* Delete Button */}
                <button
                  onClick={handleBulkDelete}
                  disabled={isBulkProcessing}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isBulkProcessing ? (
                    <>
                      <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProspects.map((prospect) => (
              <ProspectCard
                key={prospect.id}
                prospect={prospect}
                onClick={() => !selectionMode && setSelectedProspect(prospect)}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(prospect.id)}
                onSelect={handleSelectProspect}
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
