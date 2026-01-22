import { NextResponse } from 'next/server';
import { saveEngagementPost, autoArchiveOldPosts, getWatchedProfiles } from '@/lib/supabase';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || '';
const APIFY_ACTOR = 'harvestapi~linkedin-profile-posts';

// Apify response can have various field names depending on the actor version
interface ApifyPost {
  // Post URL variations
  postUrl?: string;
  url?: string;
  link?: string;
  linkedinUrl?: string;  // harvestapi actor uses this
  // Post content variations
  text?: string;
  postText?: string;
  content?: string;
  // Date variations - postedAt can be string or object with date/timestamp
  postedAt?: string | Record<string, unknown>;
  postedDate?: string;
  date?: string;
  timestamp?: string;
  postedAtTimestamp?: number;
  // Author variations - can be string or object
  authorName?: string;
  author?: string | { name?: string; url?: string; profileUrl?: string; profilePicture?: string };
  fullName?: string;
  authorProfilePicture?: string;
  authorProfileUrl?: string;
  profileUrl?: string;
  authorUrl?: string;
  // Query field contains the original profile URL we requested
  query?: string;
}

interface ProspectInput {
  id: string;
  linkedinUrl: string;
  fullName: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let { prospects, useWatchedProfiles } = body as { prospects?: ProspectInput[]; useWatchedProfiles?: boolean };

    // If useWatchedProfiles is true or no prospects provided, fetch from watched profiles
    if (useWatchedProfiles || !prospects || prospects.length === 0) {
      const watchedProfiles = await getWatchedProfiles();
      if (!watchedProfiles || watchedProfiles.length === 0) {
        return NextResponse.json(
          { error: 'No watched profiles configured. Add profiles to your watch list first.' },
          { status: 400 }
        );
      }

      prospects = watchedProfiles.map((wp: Record<string, unknown>) => {
        const prospect = wp.prospects as Record<string, unknown>;
        return {
          id: prospect.id as string,
          linkedinUrl: prospect.linkedin_url as string,
          fullName: prospect.full_name as string
        };
      });
    }

    if (!prospects || prospects.length === 0) {
      return NextResponse.json(
        { error: 'No prospects to fetch posts for' },
        { status: 400 }
      );
    }

    if (!APIFY_TOKEN) {
      return NextResponse.json(
        { error: 'Apify API token not configured' },
        { status: 500 }
      );
    }

    // Extract LinkedIn URLs for Apify
    const targetUrls = prospects.map(p => p.linkedinUrl);

    // Start Apify actor run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrls,
          maxPosts: 1,
          scrapeReactions: false,
          scrapeComments: false,
          includeQuotePosts: true,
          includeReposts: true
        })
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Apify run start failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to start Apify actor', details: errorText },
        { status: 500 }
      );
    }

    const runData = await runResponse.json();
    const runId = runData.data?.id;

    if (!runId) {
      return NextResponse.json(
        { error: 'Failed to get Apify run ID' },
        { status: 500 }
      );
    }

    // Poll for completion (max 2 minutes)
    let attempts = 0;
    const maxAttempts = 24; // 24 * 5 seconds = 2 minutes
    let runStatus = 'RUNNING';

    while (runStatus === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
      );
      const statusData = await statusResponse.json();
      runStatus = statusData.data?.status || 'FAILED';
      attempts++;
    }

    if (runStatus !== 'SUCCEEDED') {
      return NextResponse.json(
        { error: `Apify run failed or timed out. Status: ${runStatus}` },
        { status: 500 }
      );
    }

    // Fetch results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`
    );
    const rawPosts = await resultsResponse.json();

    console.log('Apify returned', rawPosts.length, 'items');
    if (rawPosts.length > 0) {
      console.log('Sample post structure:', JSON.stringify(rawPosts[0], null, 2));
    }

    // Helper to extract field with fallbacks
    // linkedinUrl is primary field from harvestapi actor
    const getPostUrl = (p: ApifyPost) => p.linkedinUrl || p.postUrl || p.url || p.link;
    const getPostText = (p: ApifyPost) => p.text || p.postText || p.content;
    const getPostedAt = (p: ApifyPost): string | null => {
      // postedAt can be a string, object with date/timestamp, or number
      if (p.postedAt) {
        if (typeof p.postedAt === 'string') return p.postedAt;
        if (typeof p.postedAt === 'object') {
          const pa = p.postedAt as Record<string, unknown>;
          // Try common object structures
          if (pa.date && typeof pa.date === 'string') return pa.date;
          if (pa.dateTime && typeof pa.dateTime === 'string') return pa.dateTime;
          if (pa.timestamp && typeof pa.timestamp === 'number') {
            return new Date(pa.timestamp * 1000).toISOString();
          }
          if (pa.time && typeof pa.time === 'number') {
            return new Date(pa.time).toISOString();
          }
          // Log the object structure for debugging
          console.log('postedAt is object with keys:', Object.keys(pa), 'values:', pa);
        }
      }
      if (p.postedDate && typeof p.postedDate === 'string') return p.postedDate;
      if (p.date && typeof p.date === 'string') return p.date;
      if (p.timestamp && typeof p.timestamp === 'string') return p.timestamp;
      if (p.postedAtTimestamp && typeof p.postedAtTimestamp === 'number') {
        return new Date(p.postedAtTimestamp * 1000).toISOString();
      }
      return null;
    };
    // Author can be a string or an object with name property
    const getAuthorName = (p: ApifyPost): string => {
      if (p.authorName) return p.authorName;
      if (typeof p.author === 'string') return p.author;
      if (typeof p.author === 'object' && p.author?.name) return p.author.name;
      if (p.fullName) return p.fullName;
      return '';
    };
    // Get the query URL (the profile we requested posts from) - this is the most reliable for matching
    const getQueryUrl = (p: ApifyPost): string => {
      if (p.query && typeof p.query === 'string') return p.query;
      return '';
    };
    // Extract author URL from author object or direct fields (for display purposes)
    const getAuthorUrl = (p: ApifyPost): string => {
      if (typeof p.author === 'object' && p.author) {
        // Ensure we return strings
        if (p.author.profileUrl && typeof p.author.profileUrl === 'string') return p.author.profileUrl;
        if (p.author.url && typeof p.author.url === 'string') return p.author.url;
      }
      // Fallback to other fields, ensure string
      const fallback = p.authorProfileUrl || p.profileUrl || p.authorUrl || '';
      return typeof fallback === 'string' ? fallback : '';
    };
    // Get author profile picture
    const getAuthorPhoto = (p: ApifyPost): string | undefined => {
      if (typeof p.author === 'object' && p.author?.profilePicture) {
        return p.author.profilePicture;
      }
      return p.authorProfilePicture;
    };

    // Helper to normalize LinkedIn URLs for consistent matching
    const normalizeLinkedInUrl = (url: string): string => {
      return url
        .toLowerCase()
        .replace(/^https?:\/\//, '')  // Remove protocol
        .replace(/^www\./, '')         // Remove www
        .replace(/\/$/, '');           // Remove trailing slash
    };

    // Extract just the username from a LinkedIn URL
    const extractUsername = (url: string): string | null => {
      const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/i);
      return match ? match[1].toLowerCase() : null;
    };

    // Create a map of LinkedIn URL to prospect for quick lookup
    // Use multiple formats for better matching
    const prospectMap = new Map<string, ProspectInput>();
    prospects.forEach(p => {
      // Store with various normalizations
      const url = p.linkedinUrl;
      const normalizedUrl = normalizeLinkedInUrl(url);
      const username = extractUsername(url);

      // Store by normalized URL
      prospectMap.set(normalizedUrl, p);
      // Store by original lowercase
      prospectMap.set(url.toLowerCase(), p);
      prospectMap.set(url.toLowerCase().replace(/\/$/, ''), p);
      // Store by username only
      if (username) {
        prospectMap.set(username, p);
      }
    });

    // Process posts - filter by age and save
    // Using 7 days for now to ensure we capture posts
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const savedActivePosts: unknown[] = [];
    const savedArchivedPosts: unknown[] = [];
    const skippedPosts = [];
    const posts: ApifyPost[] = rawPosts;

    for (const post of posts) {
      const postUrl = getPostUrl(post);
      const postText = getPostText(post);

      // Debug: log what we're extracting
      console.log('Processing post:', {
        query: post.query,
        linkedinUrl: post.linkedinUrl,
        postUrl: post.postUrl,
        url: post.url,
        extractedUrl: postUrl,
        hasContent: !!post.content,
        hasText: !!post.text,
        extractedText: postText?.substring(0, 50),
        postedAt: post.postedAt,
        authorType: typeof post.author,
        author: post.author
      });

      if (!postUrl || !postText) {
        skippedPosts.push({
          url: postUrl || 'unknown',
          reason: `Missing ${!postUrl ? 'URL' : 'text'}`,
          rawKeys: Object.keys(post),
          linkedinUrlField: post.linkedinUrl,
          contentField: post.content
        });
        continue;
      }

      // Find the prospect this post belongs to
      // Priority 1: Use query URL (the profile we requested posts from)
      // Priority 2: Use author URL (for original posts)
      // Priority 3: Match by name
      const queryUrl = getQueryUrl(post);
      const authorUrl = getAuthorUrl(post);
      const authorName = getAuthorName(post);
      let prospect: ProspectInput | undefined;

      // Helper to try matching a URL against our prospect map
      const tryMatchUrl = (url: string): ProspectInput | undefined => {
        if (!url) return undefined;
        // Try normalized URL
        const normalized = normalizeLinkedInUrl(url);
        if (prospectMap.has(normalized)) return prospectMap.get(normalized);
        // Try lowercase original
        const lowercase = url.toLowerCase();
        if (prospectMap.has(lowercase)) return prospectMap.get(lowercase);
        if (prospectMap.has(lowercase.replace(/\/$/, ''))) return prospectMap.get(lowercase.replace(/\/$/, ''));
        // Try just username
        const username = extractUsername(url);
        if (username && prospectMap.has(username)) return prospectMap.get(username);
        return undefined;
      };

      // First, try to match by query URL (the profile we requested)
      // This is most reliable because reposts still have the requested profile's URL in query
      if (queryUrl) {
        prospect = tryMatchUrl(queryUrl);
      }

      // If no match from query, try author profile URL
      if (!prospect && authorUrl) {
        prospect = tryMatchUrl(authorUrl);
      }

      // If still no match, try by name
      if (!prospect && authorName) {
        const nameLower = authorName.toLowerCase();
        for (const p of prospects) {
          const firstName = p.fullName.toLowerCase().split(' ')[0];
          if (nameLower.includes(firstName) || firstName.includes(nameLower.split(' ')[0])) {
            prospect = p;
            break;
          }
        }
      }

      // Last resort: if only one watched profile, assign to them
      if (!prospect && prospects.length === 1) {
        prospect = prospects[0];
      }

      if (!prospect) {
        skippedPosts.push({
          url: postUrl,
          reason: 'Could not match to prospect',
          queryUrl,
          authorUrl,
          authorName
        });
        continue;
      }

      const postedAt = getPostedAt(post);
      if (!postedAt) {
        skippedPosts.push({
          url: postUrl,
          reason: 'No posted date',
          rawKeys: Object.keys(post)
        });
        continue;
      }

      const postDate = new Date(postedAt);

      // Check if date is valid
      if (isNaN(postDate.getTime())) {
        skippedPosts.push({
          url: postUrl,
          reason: `Invalid date: ${postedAt}`
        });
        continue;
      }

      // Check if post is older than 7 days - save as archived if so
      const isOldPost = postDate < cutoffDate;

      // Save the post
      try {
        const saved = await saveEngagementPost({
          prospectId: prospect.id,
          postUrl: postUrl,
          postContent: postText,
          postedAt: postDate.toISOString(),
          authorName: authorName || prospect.fullName,
          authorPhotoUrl: getAuthorPhoto(post),
          // If post is old, save it as already archived
          isArchived: isOldPost,
          archivedReason: isOldPost ? 'aged' : undefined
        });
        if (isOldPost) {
          savedArchivedPosts.push(saved);
        } else {
          savedActivePosts.push(saved);
        }
      } catch (err) {
        console.log('Error saving post:', postUrl, err);
        skippedPosts.push({ url: postUrl, reason: 'Save failed (likely duplicate)' });
      }
    }

    // Auto-archive any old posts in the database
    await autoArchiveOldPosts(2);

    // Sample first post for debugging
    const samplePost = posts[0] ? {
      linkedinUrl: posts[0].linkedinUrl,
      content: posts[0].content?.substring(0, 100),
      postedAt: posts[0].postedAt,
      author: posts[0].author
    } : null;

    return NextResponse.json({
      success: true,
      savedActive: savedActivePosts.length,
      savedArchived: savedArchivedPosts.length,
      saved: savedActivePosts.length + savedArchivedPosts.length,
      skipped: skippedPosts.length,
      totalFromApify: posts.length,
      posts: savedActivePosts,
      archivedPosts: savedArchivedPosts,
      skippedDetails: skippedPosts,
      debug: {
        watchedProfileCount: prospects.length,
        watchedUrls: prospects.map(p => p.linkedinUrl),
        samplePost
      }
    });

  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts', details: String(error) },
      { status: 500 }
    );
  }
}
