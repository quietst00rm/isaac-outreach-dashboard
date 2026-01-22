import { NextResponse } from 'next/server';
import { generateComments } from '@/lib/claude';
import { updateEngagementPostComments } from '@/lib/supabase';
import type { Prospect } from '@/types';

interface PostInput {
  postId: string;
  postContent: string;
  prospect: Partial<Prospect>;
}

export async function POST(request: Request) {
  try {
    const { posts } = await request.json() as { posts: PostInput[] };

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json(
        { error: 'No posts provided' },
        { status: 400 }
      );
    }

    const results = [];

    // Process each post - generate 3 purposeful comment options
    for (const post of posts) {
      try {
        // Generate 3 different comment styles in one call:
        // 1. Conversational (with question)
        // 2. Perspective (no company names)
        // 3. Brief and genuine
        const commentOptions = await generateComments(post.prospect, post.postContent);

        const comments = [
          commentOptions.conversational,
          commentOptions.perspective,
          commentOptions.brief
        ];

        // Save comments to database
        await updateEngagementPostComments(post.postId, comments);

        results.push({
          postId: post.postId,
          success: true,
          comments,
          styles: ['conversational', 'perspective', 'brief']
        });
      } catch (error) {
        console.error(`Error generating comments for post ${post.postId}:`, error);
        results.push({
          postId: post.postId,
          success: false,
          error: String(error)
        });
      }

      // Small delay between posts to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Error generating comments:', error);
    return NextResponse.json(
      { error: 'Failed to generate comments', details: String(error) },
      { status: 500 }
    );
  }
}
