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
  // Post content variations
  text?: string;
  postText?: string;
  content?: string;
  // Date variations
  postedAt?: string;
  postedDate?: string;
  date?: string;
  timestamp?: string;
  postedAtTimestamp?: number;
  // Author variations
  authorName?: string;
  author?: string;
  fullName?: string;
  authorProfilePicture?: string;
  authorProfileUrl?: string;
  profileUrl?: string;
  authorUrl?: string;
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
    const getPostUrl = (p: ApifyPost) => p.postUrl || p.url || p.link;
    const getPostText = (p: ApifyPost) => p.text || p.postText || p.content;
    const getPostedAt = (p: ApifyPost) => {
      if (p.postedAt) return p.postedAt;
      if (p.postedDate) return p.postedDate;
      if (p.date) return p.date;
      if (p.timestamp) return p.timestamp;
      if (p.postedAtTimestamp) return new Date(p.postedAtTimestamp * 1000).toISOString();
      return null;
    };
    const getAuthorName = (p: ApifyPost) => p.authorName || p.author || p.fullName;
    const getAuthorUrl = (p: ApifyPost) => p.authorProfileUrl || p.profileUrl || p.authorUrl;

    // Create a map of LinkedIn URL to prospect for quick lookup
    // Use multiple formats for better matching
    const prospectMap = new Map<string, ProspectInput>();
    prospects.forEach(p => {
      // Store with various normalizations
      const url = p.linkedinUrl.toLowerCase();
      prospectMap.set(url, p);
      prospectMap.set(url.replace(/\/$/, ''), p);
      // Extract username and store
      const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
      if (match) {
        prospectMap.set(match[1].toLowerCase(), p);
      }
    });

    // Process posts - filter by age and save
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const savedPosts = [];
    const skippedPosts = [];
    const posts: ApifyPost[] = rawPosts;

    for (const post of posts) {
      const postUrl = getPostUrl(post);
      const postText = getPostText(post);

      if (!postUrl || !postText) {
        skippedPosts.push({
          url: postUrl || 'unknown',
          reason: `Missing ${!postUrl ? 'URL' : 'text'}`,
          rawKeys: Object.keys(post)
        });
        continue;
      }

      // Find the prospect this post belongs to
      const authorUrl = getAuthorUrl(post)?.toLowerCase() || '';
      const authorName = getAuthorName(post) || '';
      let prospect: ProspectInput | undefined;

      // Try to match by author profile URL
      if (authorUrl) {
        // Try direct match
        prospect = prospectMap.get(authorUrl) || prospectMap.get(authorUrl.replace(/\/$/, ''));

        // Try extracting username
        if (!prospect) {
          const match = authorUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
          if (match) {
            prospect = prospectMap.get(match[1].toLowerCase());
          }
        }
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

      // Skip posts older than 2 days
      if (postDate < twoDaysAgo) {
        skippedPosts.push({
          url: postUrl,
          reason: `Post older than 2 days (${postDate.toISOString()})`
        });
        continue;
      }

      // Save the post
      try {
        const saved = await saveEngagementPost({
          prospectId: prospect.id,
          postUrl: postUrl,
          postContent: postText,
          postedAt: postDate.toISOString(),
          authorName: authorName || prospect.fullName,
          authorPhotoUrl: post.authorProfilePicture
        });
        savedPosts.push(saved);
      } catch (err) {
        console.log('Error saving post:', postUrl, err);
        skippedPosts.push({ url: postUrl, reason: 'Save failed (likely duplicate)' });
      }
    }

    // Auto-archive any old posts in the database
    await autoArchiveOldPosts(2);

    return NextResponse.json({
      success: true,
      saved: savedPosts.length,
      skipped: skippedPosts.length,
      totalFromApify: posts.length,
      posts: savedPosts,
      skippedDetails: skippedPosts,
      debug: {
        watchedProfileCount: prospects.length,
        watchedUrls: prospects.map(p => p.linkedinUrl)
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
