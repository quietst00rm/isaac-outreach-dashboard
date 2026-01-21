import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only create the client if we have valid credentials
let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabase && isSupabaseConfigured()) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }
  return supabase;
}

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey &&
    supabaseUrl !== 'your_supabase_url_here' &&
    supabaseAnonKey !== 'your_supabase_anon_key_here' &&
    supabaseUrl.startsWith('http'));
}

// SQL to create tables (run this in Supabase SQL editor)
export const CREATE_TABLES_SQL = `
-- Prospects table
CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  linkedin_url TEXT UNIQUE NOT NULL,
  profile_pic_url TEXT,
  headline TEXT,
  about_summary TEXT,
  company_name TEXT,
  company_industry TEXT,
  company_size TEXT,
  job_title TEXT,
  location TEXT,
  career_history JSONB DEFAULT '[]'::jsonb,
  recent_posts JSONB DEFAULT '[]'::jsonb,
  icp_score INTEGER DEFAULT 0,
  icp_score_breakdown JSONB,
  total_experience_years NUMERIC,
  top_skills TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pipeline status table
CREATE TABLE IF NOT EXISTS pipeline_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_contacted',
  visited_at TIMESTAMPTZ,
  connection_sent_at TIMESTAMPTZ,
  connection_accepted_at TIMESTAMPTZ,
  message_sent_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,
  call_booked_at TIMESTAMPTZ,
  deal_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prospect_id)
);

-- Generated messages table
CREATE TABLE IF NOT EXISTS generated_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  used BOOLEAN DEFAULT FALSE
);

-- Watched profiles for engagement (profiles to regularly fetch posts from)
CREATE TABLE IF NOT EXISTS engagement_watched_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prospect_id)
);

-- Engagement posts table for comment workflow
CREATE TABLE IF NOT EXISTS engagement_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  post_url TEXT NOT NULL,
  post_content TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  author_name TEXT NOT NULL,
  author_photo_url TEXT,
  status TEXT DEFAULT 'active',
  archived_reason TEXT,
  generated_comments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_url)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_prospects_linkedin_url ON prospects(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_pipeline_status_prospect_id ON pipeline_status(prospect_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_status_status ON pipeline_status(status);
CREATE INDEX IF NOT EXISTS idx_generated_messages_prospect_id ON generated_messages(prospect_id);
CREATE INDEX IF NOT EXISTS idx_engagement_posts_prospect_id ON engagement_posts(prospect_id);
CREATE INDEX IF NOT EXISTS idx_engagement_posts_status ON engagement_posts(status);
CREATE INDEX IF NOT EXISTS idx_engagement_watched_profiles_prospect_id ON engagement_watched_profiles(prospect_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to prospects
DROP TRIGGER IF EXISTS update_prospects_updated_at ON prospects;
CREATE TRIGGER update_prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to pipeline_status
DROP TRIGGER IF EXISTS update_pipeline_status_updated_at ON pipeline_status;
CREATE TRIGGER update_pipeline_status_updated_at
  BEFORE UPDATE ON pipeline_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;

// Helper functions for database operations
export async function getProspects() {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('prospects')
    .select(`
      *,
      pipeline_status (*),
      generated_messages (*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getProspectById(id: string) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('prospects')
    .select(`
      *,
      pipeline_status (*),
      generated_messages (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function updatePipelineStatus(
  prospectId: string,
  updates: Record<string, unknown>
) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('pipeline_status')
    .upsert({
      prospect_id: prospectId,
      ...updates,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'prospect_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveGeneratedMessage(
  prospectId: string,
  messageType: string,
  content: string
) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('generated_messages')
    .insert({
      prospect_id: prospectId,
      message_type: messageType,
      content: content
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function upsertProspect(prospect: Record<string, unknown>) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('prospects')
    .upsert(prospect, {
      onConflict: 'linkedin_url'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Bulk import prospects with pipeline data
export async function bulkImportProspects(
  prospects: Array<{
    firstName: string;
    lastName: string;
    fullName: string;
    linkedinUrl: string;
    profilePicUrl?: string;
    headline?: string;
    aboutSummary?: string;
    companyName?: string;
    companyIndustry?: string;
    companySize?: string;
    jobTitle?: string;
    location?: string;
    careerHistory?: unknown[];
    recentPosts?: unknown[];
    icpScore?: number;
    icpScoreBreakdown?: unknown;
    totalExperienceYears?: number;
    topSkills?: string;
  }>,
  pipelineData: Map<string, { status?: string; notes?: string }>
) {
  // Transform prospects to database format
  const dbProspects = prospects.map(p => ({
    first_name: p.firstName,
    last_name: p.lastName,
    full_name: p.fullName,
    linkedin_url: p.linkedinUrl,
    profile_pic_url: p.profilePicUrl || null,
    headline: p.headline || null,
    about_summary: p.aboutSummary || null,
    company_name: p.companyName || null,
    company_industry: p.companyIndustry || null,
    company_size: p.companySize || null,
    job_title: p.jobTitle || null,
    location: p.location || null,
    career_history: p.careerHistory || [],
    recent_posts: p.recentPosts || [],
    icp_score: p.icpScore || 0,
    icp_score_breakdown: p.icpScoreBreakdown || null,
    total_experience_years: p.totalExperienceYears || null,
    top_skills: p.topSkills || null
  }));

  const client = getSupabaseClient();

  // Upsert prospects
  const { data: insertedProspects, error: prospectsError } = await client
    .from('prospects')
    .upsert(dbProspects, {
      onConflict: 'linkedin_url',
      ignoreDuplicates: false
    })
    .select();

  if (prospectsError) throw prospectsError;

  // Insert pipeline status for each prospect
  if (insertedProspects && insertedProspects.length > 0) {
    const pipelineRecords = insertedProspects.map(p => {
      const pipeline = pipelineData.get(p.linkedin_url) || {};
      return {
        prospect_id: p.id,
        status: pipeline.status || 'not_contacted',
        notes: pipeline.notes || null
      };
    });

    const { error: pipelineError } = await client
      .from('pipeline_status')
      .upsert(pipelineRecords, {
        onConflict: 'prospect_id',
        ignoreDuplicates: false
      });

    if (pipelineError) throw pipelineError;
  }

  return insertedProspects;
}

// Transform database records to app format
export function transformDbToApp(dbRecords: unknown[]): unknown[] {
  return (dbRecords || []).map((rec) => {
    const record = rec as Record<string, unknown>;
    const pipeline = Array.isArray(record.pipeline_status)
      ? record.pipeline_status[0]
      : record.pipeline_status;
    const messages = record.generated_messages || [];

    return {
      id: record.id,
      firstName: record.first_name,
      lastName: record.last_name,
      fullName: record.full_name,
      linkedinUrl: record.linkedin_url,
      profilePicUrl: record.profile_pic_url,
      headline: record.headline,
      aboutSummary: record.about_summary,
      companyName: record.company_name,
      companyIndustry: record.company_industry,
      companySize: record.company_size,
      jobTitle: record.job_title,
      location: record.location,
      careerHistory: record.career_history || [],
      recentPosts: record.recent_posts || [],
      icpScore: record.icp_score || 0,
      icpScoreBreakdown: record.icp_score_breakdown,
      totalExperienceYears: record.total_experience_years,
      topSkills: record.top_skills,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      pipeline: pipeline ? {
        id: (pipeline as Record<string, unknown>).id,
        prospectId: (pipeline as Record<string, unknown>).prospect_id,
        status: (pipeline as Record<string, unknown>).status || 'not_contacted',
        visitedAt: (pipeline as Record<string, unknown>).visited_at,
        connectionSentAt: (pipeline as Record<string, unknown>).connection_sent_at,
        connectionAcceptedAt: (pipeline as Record<string, unknown>).connection_accepted_at,
        messageSentAt: (pipeline as Record<string, unknown>).message_sent_at,
        responseReceivedAt: (pipeline as Record<string, unknown>).response_received_at,
        callBookedAt: (pipeline as Record<string, unknown>).call_booked_at,
        dealStatus: (pipeline as Record<string, unknown>).deal_status,
        notes: (pipeline as Record<string, unknown>).notes,
        createdAt: (pipeline as Record<string, unknown>).created_at,
        updatedAt: (pipeline as Record<string, unknown>).updated_at
      } : undefined,
      messages: (messages as Record<string, unknown>[]).map((m: Record<string, unknown>) => ({
        id: m.id,
        prospectId: m.prospect_id,
        messageType: m.message_type,
        content: m.content,
        generatedAt: m.generated_at,
        used: m.used
      }))
    };
  });
}

// Delete a prospect
export async function deleteProspect(id: string) {
  const client = getSupabaseClient();
  const { error } = await client
    .from('prospects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Bulk delete prospects
export async function bulkDeleteProspects(ids: string[]) {
  const client = getSupabaseClient();
  const { error } = await client
    .from('prospects')
    .delete()
    .in('id', ids);

  if (error) throw error;
}

// Bulk update pipeline status
export async function bulkUpdatePipelineStatus(
  prospectIds: string[],
  status: string
) {
  const client = getSupabaseClient();

  // Create upsert records for each prospect
  const pipelineRecords = prospectIds.map(id => ({
    prospect_id: id,
    status: status,
    updated_at: new Date().toISOString()
  }));

  const { error } = await client
    .from('pipeline_status')
    .upsert(pipelineRecords, {
      onConflict: 'prospect_id'
    });

  if (error) throw error;
}

// ============ Engagement Posts Functions ============

// Get all engagement posts with prospect data
export async function getEngagementPosts(status?: 'active' | 'archived') {
  const client = getSupabaseClient();
  let query = client
    .from('engagement_posts')
    .select(`
      *,
      prospects (*)
    `)
    .order('posted_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Save a new engagement post
export async function saveEngagementPost(post: {
  prospectId: string;
  postUrl: string;
  postContent: string;
  postedAt: string;
  authorName: string;
  authorPhotoUrl?: string;
  generatedComments?: string[];
  isArchived?: boolean;
  archivedReason?: 'aged' | 'engaged';
}) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('engagement_posts')
    .upsert({
      prospect_id: post.prospectId,
      post_url: post.postUrl,
      post_content: post.postContent,
      posted_at: post.postedAt,
      author_name: post.authorName,
      author_photo_url: post.authorPhotoUrl || null,
      generated_comments: post.generatedComments || [],
      status: post.isArchived ? 'archived' : 'active',
      archived_reason: post.archivedReason || null
    }, {
      onConflict: 'post_url'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update engagement post comments
export async function updateEngagementPostComments(
  postId: string,
  comments: string[]
) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('engagement_posts')
    .update({
      generated_comments: comments,
      updated_at: new Date().toISOString()
    })
    .eq('id', postId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Archive an engagement post
export async function archiveEngagementPost(
  postId: string,
  reason: 'aged' | 'engaged'
) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('engagement_posts')
    .update({
      status: 'archived',
      archived_reason: reason,
      updated_at: new Date().toISOString()
    })
    .eq('id', postId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Restore an archived engagement post
export async function restoreEngagementPost(postId: string) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('engagement_posts')
    .update({
      status: 'active',
      archived_reason: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', postId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Clear all archived engagement posts
export async function clearArchivedEngagementPosts() {
  const client = getSupabaseClient();
  const { error } = await client
    .from('engagement_posts')
    .delete()
    .eq('status', 'archived');

  if (error) throw error;
}

// Auto-archive posts older than specified days
export async function autoArchiveOldPosts(daysOld: number = 2) {
  const client = getSupabaseClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const { data, error } = await client
    .from('engagement_posts')
    .update({
      status: 'archived',
      archived_reason: 'aged',
      updated_at: new Date().toISOString()
    })
    .eq('status', 'active')
    .lt('posted_at', cutoffDate.toISOString())
    .select();

  if (error) throw error;
  return data;
}

// Transform engagement post from DB to app format
export function transformEngagementPost(dbPost: Record<string, unknown>): Record<string, unknown> {
  const prospect = dbPost.prospects as Record<string, unknown> | null;
  return {
    id: dbPost.id,
    prospectId: dbPost.prospect_id,
    postUrl: dbPost.post_url,
    postContent: dbPost.post_content,
    postedAt: dbPost.posted_at,
    authorName: dbPost.author_name,
    authorPhotoUrl: dbPost.author_photo_url,
    status: dbPost.status,
    archivedReason: dbPost.archived_reason,
    generatedComments: dbPost.generated_comments || [],
    createdAt: dbPost.created_at,
    updatedAt: dbPost.updated_at,
    prospect: prospect ? {
      id: prospect.id,
      firstName: prospect.first_name,
      lastName: prospect.last_name,
      fullName: prospect.full_name,
      linkedinUrl: prospect.linkedin_url,
      profilePicUrl: prospect.profile_pic_url,
      headline: prospect.headline,
      companyName: prospect.company_name,
      jobTitle: prospect.job_title,
      icpScore: prospect.icp_score
    } : undefined
  };
}

// ============ Watched Profiles Functions ============

// Get all watched profiles with prospect data
export async function getWatchedProfiles() {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('engagement_watched_profiles')
    .select(`
      *,
      prospects (*)
    `)
    .order('added_at', { ascending: false });

  if (error) throw error;
  return data;
}

// Add a profile to watch list by prospect ID
export async function addWatchedProfile(prospectId: string) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('engagement_watched_profiles')
    .upsert({
      prospect_id: prospectId
    }, {
      onConflict: 'prospect_id'
    })
    .select(`
      *,
      prospects (*)
    `)
    .single();

  if (error) throw error;
  return data;
}

// Add a profile by LinkedIn URL (creates prospect if needed)
export async function addWatchedProfileByUrl(linkedinUrl: string) {
  const client = getSupabaseClient();

  // Normalize URL
  const normalizedUrl = linkedinUrl.replace(/\/$/, '').toLowerCase();

  // First check if prospect exists
  const { data: existingProspect } = await client
    .from('prospects')
    .select('id')
    .ilike('linkedin_url', `%${normalizedUrl.split('/in/')[1]?.split('/')[0] || normalizedUrl}%`)
    .single();

  if (existingProspect) {
    // Add to watched profiles
    return addWatchedProfile(existingProspect.id);
  }

  // Create a basic prospect record
  const urlParts = normalizedUrl.split('/');
  const username = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'unknown';

  const { data: newProspect, error: prospectError } = await client
    .from('prospects')
    .insert({
      first_name: username,
      last_name: '',
      full_name: username,
      linkedin_url: linkedinUrl,
      icp_score: 0
    })
    .select()
    .single();

  if (prospectError) throw prospectError;

  // Add to watched profiles
  return addWatchedProfile(newProspect.id);
}

// Remove a profile from watch list
export async function removeWatchedProfile(prospectId: string) {
  const client = getSupabaseClient();
  const { error } = await client
    .from('engagement_watched_profiles')
    .delete()
    .eq('prospect_id', prospectId);

  if (error) throw error;
}

// Transform watched profile from DB to app format
export function transformWatchedProfile(dbRecord: Record<string, unknown>): Record<string, unknown> {
  const prospect = dbRecord.prospects as Record<string, unknown> | null;
  return {
    id: dbRecord.id,
    prospectId: dbRecord.prospect_id,
    addedAt: dbRecord.added_at,
    prospect: prospect ? {
      id: prospect.id,
      firstName: prospect.first_name,
      lastName: prospect.last_name,
      fullName: prospect.full_name,
      linkedinUrl: prospect.linkedin_url,
      profilePicUrl: prospect.profile_pic_url,
      headline: prospect.headline,
      companyName: prospect.company_name,
      jobTitle: prospect.job_title,
      icpScore: prospect.icp_score
    } : undefined
  };
}
