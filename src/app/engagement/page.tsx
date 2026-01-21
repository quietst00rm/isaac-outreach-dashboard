'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { EngagementPostWithProspect, WatchedProfileWithProspect, Prospect } from '@/types';

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
  // Watched profiles
  const [watchedProfiles, setWatchedProfiles] = useState<WatchedProfileWithProspect[]>([]);
  const [newProfileUrl, setNewProfileUrl] = useState('');
  const [isAddingProfile, setIsAddingProfile] = useState(false);

  // Engagement posts
  const [activePosts, setActivePosts] = useState<EngagementPostWithProspect[]>([]);
  const [archivedPosts, setArchivedPosts] = useState<EngagementPostWithProspect[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Loading states
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isFetchingPosts, setIsFetchingPosts] = useState(false);
  const [isGeneratingComments, setIsGeneratingComments] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch watched profiles
  const fetchWatchedProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/engagement/watched-profiles');
      if (res.ok) {
        const data = await res.json();
        setWatchedProfiles(data);
      }
    } catch (error) {
      console.error('Error fetching watched profiles:', error);
    } finally {
      setIsLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchedProfiles();
  }, [fetchWatchedProfiles]);

  // Fetch engagement posts
  const fetchEngagementPosts = useCallback(async () => {
    setIsLoadingPosts(true);
    try {
      const [activeRes, archivedRes] = await Promise.all([
        fetch('/api/engagement/posts?status=active'),
        fetch('/api/engagement/posts?status=archived')
      ]);

      if (activeRes.ok && archivedRes.ok) {
        setActivePosts(await activeRes.json());
        setArchivedPosts(await archivedRes.json());
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

  // Add a watched profile by URL
  const handleAddProfile = async () => {
    if (!newProfileUrl.trim()) return;

    setIsAddingProfile(true);
    try {
      const res = await fetch('/api/engagement/watched-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinUrl: newProfileUrl.trim() })
      });

      if (res.ok) {
        setNewProfileUrl('');
        await fetchWatchedProfiles();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to add profile');
      }
    } catch (error) {
      console.error('Error adding profile:', error);
      alert('Failed to add profile');
    } finally {
      setIsAddingProfile(false);
    }
  };

  // Remove a watched profile
  const handleRemoveProfile = async (prospectId: string) => {
    try {
      await fetch(`/api/engagement/watched-profiles/${prospectId}`, {
        method: 'DELETE'
      });
      await fetchWatchedProfiles();
    } catch (error) {
      console.error('Error removing profile:', error);
    }
  };

  // Fetch posts for all watched profiles
  const handleFetchPosts = async () => {
    if (watchedProfiles.length === 0) {
      alert('Add some profiles to your watch list first');
      return;
    }

    setIsFetchingPosts(true);
    try {
      const res = await fetch('/api/engagement/fetch-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useWatchedProfiles: true })
      });

      if (res.ok) {
        const data = await res.json();
        console.log('Fetched posts:', data);

        // Generate comments for new posts
        if (data.posts && data.posts.length > 0) {
          setIsGeneratingComments(true);

          // Get full prospect data for comment generation
          const postsToGenerate = data.posts.map((post: Record<string, unknown>) => {
            const watchedProfile = watchedProfiles.find(
              wp => wp.prospectId === post.prospect_id
            );
            return {
              postId: post.id,
              postContent: post.post_content,
              prospect: watchedProfile?.prospect || { fullName: post.author_name }
            };
          });

          await fetch('/api/engagement/generate-comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ posts: postsToGenerate })
          });
          setIsGeneratingComments(false);
        }

        // Refresh posts list
        await fetchEngagementPosts();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to fetch posts');
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      alert('Failed to fetch posts');
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
              onClick={handleFetchPosts}
              disabled={isFetchingPosts || watchedProfiles.length === 0}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFetchingPosts || isGeneratingComments ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isGeneratingComments ? 'Generating Comments...' : 'Fetching Posts...'}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Fetch Posts ({watchedProfiles.length} profiles)
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Watched Profiles Section */}
        <section className="mb-8 bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Watched Profiles ({watchedProfiles.length})
          </h2>

          {/* Add Profile Input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newProfileUrl}
              onChange={(e) => setNewProfileUrl(e.target.value)}
              placeholder="Paste LinkedIn profile URL..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAddProfile()}
            />
            <button
              onClick={handleAddProfile}
              disabled={isAddingProfile || !newProfileUrl.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isAddingProfile ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </>
              )}
            </button>
          </div>

          {/* Watched Profiles List */}
          {isLoadingProfiles ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : watchedProfiles.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              No profiles added yet. Paste a LinkedIn URL above to start tracking.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {watchedProfiles.map(wp => (
                <div
                  key={wp.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
                >
                  {wp.prospect?.profilePicUrl ? (
                    <Image
                      src={wp.prospect.profilePicUrl}
                      alt={wp.prospect.fullName || ''}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                      {getInitials(wp.prospect?.fullName || '?')}
                    </div>
                  )}
                  <span className="font-medium text-gray-700">
                    {wp.prospect?.fullName || 'Unknown'}
                  </span>
                  {wp.prospect?.companyName && (
                    <span className="text-gray-500">
                      @ {wp.prospect.companyName}
                    </span>
                  )}
                  <a
                    href={wp.prospect?.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                  <button
                    onClick={() => handleRemoveProfile(wp.prospectId)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="Remove from watch list"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

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
              <p className="text-gray-500 mb-4">
                {watchedProfiles.length === 0
                  ? 'Add profiles to your watch list, then fetch their posts'
                  : 'Click "Fetch Posts" to get recent posts from watched profiles'}
              </p>
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
    </div>
  );
}
