'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { ProspectWithPipeline, EngagementPostWithProspect } from '@/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return 'Just now';
}

export default function EngagementPage() {
  // Prospects for selection
  const [prospects, setProspects] = useState<ProspectWithPipeline[]>([]);
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set());
  const [showProspectSelector, setShowProspectSelector] = useState(false);
  const [prospectSearch, setProspectSearch] = useState('');

  // Engagement posts
  const [activePosts, setActivePosts] = useState<EngagementPostWithProspect[]>([]);
  const [archivedPosts, setArchivedPosts] = useState<EngagementPostWithProspect[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Loading states
  const [isLoadingProspects, setIsLoadingProspects] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isFetchingPosts, setIsFetchingPosts] = useState(false);
  const [isGeneratingComments, setIsGeneratingComments] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch prospects
  useEffect(() => {
    const fetchProspects = async () => {
      try {
        const res = await fetch('/api/prospects');
        if (res.ok) {
          const data = await res.json();
          setProspects(data);
        }
      } catch (error) {
        console.error('Error fetching prospects:', error);
      } finally {
        setIsLoadingProspects(false);
      }
    };
    fetchProspects();
  }, []);

  // Fetch engagement posts
  const fetchEngagementPosts = useCallback(async () => {
    setIsLoadingPosts(true);
    try {
      const [activeRes, archivedRes] = await Promise.all([
        fetch('/api/engagement/posts?status=active'),
        fetch('/api/engagement/posts?status=archived')
      ]);

      if (activeRes.ok) {
        const activeData = await archivedRes.json();
        setActivePosts(await activeRes.json());
        setArchivedPosts(activeData);
      }
    } catch (error) {
      console.error('Error fetching engagement posts:', error);
    } finally {
      setIsLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    fetchEngagementPosts();
  }, [fetchEngagementPosts]);

  // Toggle prospect selection
  const toggleProspectSelection = (id: string) => {
    setSelectedProspectIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Fetch posts for selected prospects
  const handleFetchPosts = async () => {
    if (selectedProspectIds.size === 0) return;

    setIsFetchingPosts(true);
    try {
      const selectedProspects = prospects
        .filter(p => selectedProspectIds.has(p.id))
        .map(p => ({
          id: p.id,
          linkedinUrl: p.linkedinUrl,
          fullName: p.fullName
        }));

      const res = await fetch('/api/engagement/fetch-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospects: selectedProspects })
      });

      if (res.ok) {
        const data = await res.json();
        console.log('Fetched posts:', data);

        // Generate comments for new posts
        if (data.posts && data.posts.length > 0) {
          setIsGeneratingComments(true);
          const postsToGenerate = data.posts.map((post: { id: string; post_content: string; prospect_id: string }) => ({
            postId: post.id,
            postContent: post.post_content,
            prospect: prospects.find(p => p.id === post.prospect_id)
          }));

          await fetch('/api/engagement/generate-comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ posts: postsToGenerate })
          });
          setIsGeneratingComments(false);
        }

        // Refresh posts list
        await fetchEngagementPosts();
        setShowProspectSelector(false);
        setSelectedProspectIds(new Set());
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setIsFetchingPosts(false);
      setIsGeneratingComments(false);
    }
  };

  // Mark as engaged (archive)
  const handleMarkEngaged = async (postId: string) => {
    try {
      await fetch(`/api/engagement/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', reason: 'engaged' })
      });
      await fetchEngagementPosts();
    } catch (error) {
      console.error('Error marking as engaged:', error);
    }
  };

  // Restore archived post
  const handleRestore = async (postId: string) => {
    try {
      await fetch(`/api/engagement/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' })
      });
      await fetchEngagementPosts();
    } catch (error) {
      console.error('Error restoring post:', error);
    }
  };

  // Clear all archived
  const handleClearArchived = async () => {
    if (!confirm('Are you sure you want to permanently delete all archived posts?')) return;

    try {
      await fetch('/api/engagement/clear-archived', { method: 'DELETE' });
      await fetchEngagementPosts();
    } catch (error) {
      console.error('Error clearing archived:', error);
    }
  };

  // Copy comment to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter prospects by search
  const filteredProspects = prospects.filter(p =>
    p.fullName.toLowerCase().includes(prospectSearch.toLowerCase()) ||
    p.companyName?.toLowerCase().includes(prospectSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Engagement Queue</h1>
            </div>
            <button
              onClick={() => setShowProspectSelector(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Fetch New Posts
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Active Posts Queue */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Active Queue ({activePosts.length} posts)
          </h2>

          {isLoadingPosts ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : activePosts.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No active posts</h3>
              <p className="text-gray-500 mb-4">Fetch posts from your prospects to start engaging</p>
              <button
                onClick={() => setShowProspectSelector(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Fetch Posts
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {activePosts.map(post => (
                <div key={post.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  {/* Post Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start gap-3">
                      {post.authorPhotoUrl ? (
                        <Image
                          src={post.authorPhotoUrl}
                          alt={post.authorName}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {getInitials(post.authorName)}
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{post.authorName}</h3>
                        {post.prospect && (
                          <p className="text-sm text-gray-500">
                            {post.prospect.jobTitle} at {post.prospect.companyName}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(post.postedAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={post.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg hover:bg-blue-50"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open Post
                        </a>
                        <button
                          onClick={() => handleMarkEngaged(post.id)}
                          className="inline-flex items-center px-3 py-1.5 text-sm text-green-600 hover:text-green-800 border border-green-200 rounded-lg hover:bg-green-50"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Engaged
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Post Content */}
                  <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <p className="text-gray-700 whitespace-pre-wrap text-sm">
                      {post.postContent.length > 500
                        ? post.postContent.substring(0, 500) + '...'
                        : post.postContent}
                    </p>
                  </div>

                  {/* Generated Comments */}
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Generated Comments ({post.generatedComments?.length || 0})
                    </h4>
                    {post.generatedComments && post.generatedComments.length > 0 ? (
                      <div className="space-y-3">
                        {post.generatedComments.map((comment, idx) => (
                          <div key={idx} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <span className="text-xs font-medium text-gray-500 mb-1 block">
                                Option {idx + 1}
                              </span>
                              <p className="text-sm text-gray-800">{comment}</p>
                            </div>
                            <button
                              onClick={() => copyToClipboard(comment, `${post.id}-${idx}`)}
                              className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                                copiedId === `${post.id}-${idx}`
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                            >
                              {copiedId === `${post.id}-${idx}` ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No comments generated yet</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Archived Posts Section */}
        <section>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
          >
            <svg
              className={`w-5 h-5 transition-transform ${showArchived ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-medium">Archived ({archivedPosts.length})</span>
          </button>

          {showArchived && archivedPosts.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={handleClearArchived}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Clear All Archived
                </button>
              </div>

              {archivedPosts.map(post => (
                <div key={post.id} className="bg-white rounded-lg border border-gray-200 p-4 opacity-75">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium">
                      {getInitials(post.authorName)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-700">{post.authorName}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.postContent}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          post.archivedReason === 'engaged'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {post.archivedReason === 'engaged' ? 'Engaged' : 'Aged Out'}
                        </span>
                        <button
                          onClick={() => handleRestore(post.id)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Prospect Selector Modal */}
      {showProspectSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Select Prospects</h2>
                <button
                  onClick={() => {
                    setShowProspectSelector(false);
                    setSelectedProspectIds(new Set());
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                type="text"
                value={prospectSearch}
                onChange={(e) => setProspectSearch(e.target.value)}
                placeholder="Search prospects..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingProspects ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProspects.map(prospect => (
                    <label
                      key={prospect.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedProspectIds.has(prospect.id)
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProspectIds.has(prospect.id)}
                        onChange={() => toggleProspectSelection(prospect.id)}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
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
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                          {getInitials(prospect.fullName)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{prospect.fullName}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {prospect.jobTitle} at {prospect.companyName}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {selectedProspectIds.size} selected
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowProspectSelector(false);
                    setSelectedProspectIds(new Set());
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFetchPosts}
                  disabled={selectedProspectIds.size === 0 || isFetchingPosts}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isFetchingPosts || isGeneratingComments ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {isGeneratingComments ? 'Generating Comments...' : 'Fetching Posts...'}
                    </>
                  ) : (
                    'Fetch Posts'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
