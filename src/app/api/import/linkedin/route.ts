import { NextRequest, NextResponse } from 'next/server';
import { calculateICPScoreWithBreakdown } from '@/lib/import';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || '';
const APIFY_ACTOR = process.env.APIFY_ACTOR || 'dev_fusion~linkedin-profile-scraper';

interface ApifyProfile {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  about?: string;
  summary?: string;
  // Profile picture can come under many different field names
  profilePicture?: string;
  profilePictureUrl?: string;
  profilePic?: string;
  profilePhoto?: string;
  photoUrl?: string;
  photo?: string;
  imageUrl?: string;
  avatar?: string;
  picture?: string;
  imgUrl?: string;
  linkedinUrl?: string;
  profileUrl?: string;
  url?: string;
  location?: string;
  companyName?: string;
  companyIndustry?: string;
  companySize?: string;
  jobTitle?: string;
  title?: string;
  position?: string;
  experiences?: Array<{
    companyName?: string;
    company?: string;
    title?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    jobDescription?: string;
    description?: string;
    duration?: string;
  }>;
  skills?: string[];
  topSkillsByEndorsements?: string;
  totalExperienceYears?: number;
  // Allow any other fields from the API
  [key: string]: unknown;
}

function normalizeLinkedInUrl(url: string): string {
  let normalized = url.toLowerCase().trim();

  // Remove query params and trailing slashes
  normalized = normalized.split('?')[0].replace(/\/+$/, '');

  // Ensure https and www
  if (!normalized.startsWith('http')) {
    normalized = 'https://' + normalized;
  }
  normalized = normalized.replace('http://', 'https://');
  if (normalized.includes('linkedin.com') && !normalized.includes('www.linkedin.com')) {
    normalized = normalized.replace('linkedin.com', 'www.linkedin.com');
  }

  return normalized;
}

function isValidLinkedInProfileUrl(url: string): boolean {
  const normalized = normalizeLinkedInUrl(url);
  // Match /in/ pattern for profile URLs
  return /linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/.test(normalized);
}

function getProfilePicture(profile: ApifyProfile): string | undefined {
  // Check all possible field names for profile picture
  // Prioritize high quality version first
  const possibleFields = [
    'profilePicHighQuality',
    'profilePic',
    'profilePicture',
    'profilePictureUrl',
    'profilePhoto',
    'photoUrl',
    'photo',
    'imageUrl',
    'avatar',
    'picture',
    'imgUrl',
    'image',
    'img'
  ];

  for (const field of possibleFields) {
    const value = profile[field];
    // Check if it's a valid URL string
    if (value && typeof value === 'string' && (value.startsWith('http') || value.startsWith('//'))) {
      // Handle protocol-relative URLs
      if (value.startsWith('//')) {
        return 'https:' + value;
      }
      return value;
    }
  }

  return undefined;
}

function getLinkedInUrl(profile: ApifyProfile): string {
  // Check possible field names for LinkedIn URL
  const url = profile.linkedinUrl || profile.profileUrl || profile.url || '';
  return normalizeLinkedInUrl(url);
}

function mapApifyToProspect(profile: ApifyProfile) {
  const firstName = profile.firstName || profile.fullName?.split(' ')[0] || '';
  const lastName = profile.lastName || profile.fullName?.split(' ').slice(1).join(' ') || '';
  const fullName = profile.fullName || `${firstName} ${lastName}`.trim();

  // Extract career history from experiences
  const careerHistory = (profile.experiences || []).slice(0, 5).map(exp => ({
    companyName: exp.companyName || exp.company || '',
    title: exp.title || '',
    location: exp.location || '',
    startDate: exp.startDate || '',
    endDate: exp.endDate || '',
    description: exp.jobDescription || exp.description || '',
    duration: exp.duration || ''
  }));

  // Get current job from first experience
  const currentJob = profile.experiences?.[0];

  // Get profile picture from various possible field names
  const profilePicUrl = getProfilePicture(profile);

  const prospect = {
    firstName,
    lastName,
    fullName,
    linkedinUrl: getLinkedInUrl(profile),
    profilePicUrl,
    headline: profile.headline || undefined,
    aboutSummary: profile.about || profile.summary || undefined,
    companyName: profile.companyName || currentJob?.companyName || currentJob?.company || undefined,
    companyIndustry: profile.companyIndustry || undefined,
    companySize: profile.companySize || undefined,
    jobTitle: profile.jobTitle || profile.title || profile.position || currentJob?.title || undefined,
    location: profile.location || undefined,
    careerHistory,
    recentPosts: [] as unknown[],
    totalExperienceYears: profile.totalExperienceYears || undefined,
    topSkills: profile.topSkillsByEndorsements || profile.skills?.join(', ') || undefined,
  };

  // Calculate ICP score
  const icpBreakdown = calculateICPScoreWithBreakdown(prospect);

  return {
    ...prospect,
    icpScore: icpBreakdown.total,
    icpScoreBreakdown: icpBreakdown
  };
}

export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'No URLs provided' },
        { status: 400 }
      );
    }

    // Validate and normalize URLs
    const validUrls: string[] = [];
    const invalidUrls: string[] = [];

    for (const url of urls) {
      const trimmed = url.trim();
      if (!trimmed) continue;

      if (isValidLinkedInProfileUrl(trimmed)) {
        validUrls.push(normalizeLinkedInUrl(trimmed));
      } else {
        invalidUrls.push(trimmed);
      }
    }

    if (validUrls.length === 0) {
      return NextResponse.json(
        { error: 'No valid LinkedIn profile URLs found', invalidUrls },
        { status: 400 }
      );
    }

    // Call Apify API
    const apifyUrl = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

    const apifyResponse = await fetch(apifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileUrls: validUrls
      }),
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('Apify API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch profiles from Apify', details: errorText },
        { status: 500 }
      );
    }

    const profiles: ApifyProfile[] = await apifyResponse.json();

    // Log first profile to help debug field names
    if (profiles.length > 0) {
      console.log('Sample Apify profile fields:', Object.keys(profiles[0]));
      console.log('Sample profile picture fields:', {
        profilePic: profiles[0].profilePic,
        profilePicHighQuality: profiles[0].profilePicHighQuality,
      });
      console.log('Extracted profile pic URL:', getProfilePicture(profiles[0]));
    }

    // Map profiles to prospects
    const prospects = profiles
      .filter(p => p && (p.linkedinUrl || p.profileUrl || p.url))
      .map(mapApifyToProspect);

    return NextResponse.json({
      success: true,
      prospects,
      stats: {
        requested: urls.length,
        valid: validUrls.length,
        invalid: invalidUrls.length,
        fetched: prospects.length,
        invalidUrls: invalidUrls.length > 0 ? invalidUrls : undefined
      },
      // Debug: show raw field names from first profile
      debug: profiles.length > 0 ? {
        availableFields: Object.keys(profiles[0]),
        sampleValues: {
          profilePic: profiles[0].profilePic,
          profilePicHighQuality: profiles[0].profilePicHighQuality,
          profilePicture: profiles[0].profilePicture,
          profilePictureUrl: profiles[0].profilePictureUrl,
          photoUrl: profiles[0].photoUrl,
          photo: profiles[0].photo,
          imageUrl: profiles[0].imageUrl,
          avatar: profiles[0].avatar,
          picture: profiles[0].picture,
          imgUrl: profiles[0].imgUrl
        },
        // Show what our function extracted
        extractedProfilePic: getProfilePicture(profiles[0])
      } : null
    });

  } catch (error) {
    console.error('Error in LinkedIn import:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
