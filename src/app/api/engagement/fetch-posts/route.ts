import { NextResponse } from 'next/server';
import { saveEngagementPost, autoArchiveOldPosts, getWatchedProfiles } from '@/lib/supabase';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || '';
const APIFY_ACTOR = 'harvestapi~linkedin-profile-posts';

interface ApifyPost {
  postUrl?: string;
  text?: string;
  postedAt?: string;
  postedDate?: string;
  authorName?: string;
  authorProfilePicture?: string;
  authorProfileUrl?: string;
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
    const posts: ApifyPost[] = await resultsResponse.json();

    // Create a map of LinkedIn URL to prospect for quick lookup
    const prospectMap = new Map<string, ProspectInput>();
    prospects.forEach(p => {
      // Normalize URL for matching
      const normalizedUrl = p.linkedinUrl.replace(/\/$/, '').toLowerCase();
      prospectMap.set(normalizedUrl, p);
    });

    // Process posts - filter by age and save
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const savedPosts = [];
    const skippedPosts = [];

    for (const post of posts) {
      if (!post.postUrl || !post.text) continue;

      // Find the prospect this post belongs to
      const authorUrl = post.authorProfileUrl?.replace(/\/$/, '').toLowerCase() || '';
      let prospect: ProspectInput | undefined;

      // Try to match by author profile URL
      for (const [url, p] of prospectMap.entries()) {
        if (authorUrl.includes(url) || url.includes(authorUrl)) {
          prospect = p;
          break;
        }
      }

      if (!prospect) {
        // If we couldn't match, try to find by author name
        for (const p of prospects) {
          if (post.authorName?.toLowerCase().includes(p.fullName.toLowerCase().split(' ')[0])) {
            prospect = p;
            break;
          }
        }
      }

      if (!prospect) {
        skippedPosts.push({ url: post.postUrl, reason: 'Could not match to prospect' });
        continue;
      }

      const postedAt = post.postedAt || post.postedDate;
      if (!postedAt) {
        skippedPosts.push({ url: post.postUrl, reason: 'No posted date' });
        continue;
      }

      const postDate = new Date(postedAt);

      // Skip posts older than 2 days - they'll be archived
      if (postDate < twoDaysAgo) {
        skippedPosts.push({ url: post.postUrl, reason: 'Post older than 2 days' });
        continue;
      }

      // Save the post
      try {
        const saved = await saveEngagementPost({
          prospectId: prospect.id,
          postUrl: post.postUrl,
          postContent: post.text,
          postedAt: postDate.toISOString(),
          authorName: post.authorName || prospect.fullName,
          authorPhotoUrl: post.authorProfilePicture
        });
        savedPosts.push(saved);
      } catch (err) {
        // Likely a duplicate - skip
        console.log('Skipping duplicate post:', post.postUrl);
      }
    }

    // Auto-archive any old posts in the database
    await autoArchiveOldPosts(2);

    return NextResponse.json({
      success: true,
      saved: savedPosts.length,
      skipped: skippedPosts.length,
      posts: savedPosts,
      skippedDetails: skippedPosts
    });

  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts', details: String(error) },
      { status: 500 }
    );
  }
}
