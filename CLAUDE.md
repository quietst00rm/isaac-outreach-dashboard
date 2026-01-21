# Isaac Outreach Dashboard

LinkedIn outreach management system for Isaac Stern (Co-Founder of Parcelis). Single-user tool for managing prospects, generating personalized messages using Isaac's voice profile, tracking pipeline status, and engaging with LinkedIn posts.

## Quick Context

**Who Isaac Is:**
- Co-Founder of Parcelis (e-commerce shipping insurance backed by The Hartford)
- "The Merchant Guardian" - finds hidden money merchants are losing
- Previously built and sold Legacy Seller to Threecolts (a $200M aggregator serving Samsung, L'Oreal)
- Runs Truscope Golf (DTC brand) - has skin in the game as an operator

**Outreach Purpose:**
- Build Isaac's LinkedIn presence as a thought leader
- Connect with high-volume Shopify merchants (500+ packages/month) and Shopify agencies
- Drive partnership conversations and Parcelis installations
- Comment engagement + personalized connection requests

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) - optional, falls back to local state |
| AI | OpenAI GPT-4o for message/comment generation |
| Profile Scraping | Apify (`dev_fusion~linkedin-profile-scraper`) |
| Post Scraping | Apify (`harvestapi~linkedin-profile-posts`) |
| Deployment | Vercel |
| GitHub | https://github.com/quietst00rm/isaac-outreach-dashboard |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main dashboard (grid/pipeline views)
│   ├── engagement/page.tsx         # Engagement queue for post commenting
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Tailwind imports
│   └── api/
│       ├── messages/generate/route.ts        # POST - Generate AI messages
│       ├── import/linkedin/route.ts          # POST - Bulk import profiles via Apify
│       ├── prospects/route.ts                # GET - List all prospects
│       ├── prospects/bulk-delete/route.ts    # POST - Delete multiple prospects
│       ├── prospects/bulk-status/route.ts    # POST - Update status for multiple
│       ├── prospects/recalculate-icp/route.ts # POST - Recalculate all ICP scores
│       └── engagement/
│           ├── fetch-posts/route.ts          # POST - Fetch posts via Apify
│           ├── generate-comments/route.ts    # POST - Generate 3 comments per post
│           ├── posts/route.ts                # GET - List engagement posts
│           ├── posts/[id]/route.ts           # PATCH - Archive/restore post
│           ├── watched-profiles/route.ts     # GET/POST - Manage watched profiles
│           ├── watched-profiles/[id]/route.ts # DELETE - Remove watched profile
│           └── clear-archived/route.ts       # DELETE - Clear archived posts
├── components/
│   ├── index.ts                    # Barrel exports
│   ├── ProspectCard.tsx            # Grid view card with segment badge
│   ├── ProspectDetail.tsx          # Modal with full profile + messages
│   ├── PipelineBoard.tsx           # Kanban drag-drop view
│   ├── ImportModal.tsx             # Excel file import
│   ├── AddProspectModal.tsx        # Manual prospect entry
│   └── BulkUrlImportModal.tsx      # LinkedIn URL import via Apify
├── lib/
│   ├── supabase.ts                 # DB client + CRUD + engagement functions
│   ├── claude.ts                   # OpenAI message/comment generation
│   ├── voice-profile.ts            # Isaac's voice rules + prompts
│   └── import.ts                   # Excel parsing + ICP scoring
└── types/
    └── index.ts                    # All TypeScript interfaces
```

---

## Environment Variables

Required in `.env.local` and Vercel dashboard:

```bash
# OpenAI API Key (for message generation)
OPENAI_API_KEY=sk-proj-...

# Supabase (for persistent storage)
NEXT_PUBLIC_SUPABASE_URL=https://nougobcvppzcnkjypqss.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Apify API Token (for LinkedIn scraping - profiles and posts)
APIFY_API_TOKEN=apify_api_...
```

---

## Database Schema (Supabase)

### prospects
Primary table for all prospect data.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| first_name, last_name, full_name | TEXT | Name fields |
| linkedin_url | TEXT | **UNIQUE**, normalized URL |
| profile_pic_url | TEXT | Profile image URL |
| headline, about_summary | TEXT | LinkedIn bio sections |
| company_name, company_industry, company_size | TEXT | Company info |
| job_title, location | TEXT | Role info |
| career_history | JSONB | Array of `{ companyName, title, description, startDate, endDate, isCurrent }` |
| recent_posts | JSONB | Array of RecentPost objects (currently unused) |
| icp_score | INTEGER | 0-100 calculated score |
| icp_score_breakdown | JSONB | `{ segment, titleAuthority, companySignals, companySize, productCategory, profileCompleteness, total }` |
| total_experience_years | NUMERIC | Years of experience |
| top_skills | TEXT | Comma-separated skills |
| created_at, updated_at | TIMESTAMPTZ | Auto timestamps with trigger |

### pipeline_status
Tracks outreach progress for each prospect.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| prospect_id | UUID | FK to prospects (**UNIQUE** - one status per prospect) |
| status | TEXT | Pipeline stage enum (see below) |
| visited_at | TIMESTAMPTZ | When profile was visited |
| connection_sent_at | TIMESTAMPTZ | When connection request sent |
| connection_accepted_at | TIMESTAMPTZ | When they accepted |
| message_sent_at | TIMESTAMPTZ | When first message sent |
| response_received_at | TIMESTAMPTZ | When they replied |
| call_booked_at | TIMESTAMPTZ | When call was scheduled |
| deal_status | TEXT | Won/lost details |
| notes | TEXT | Free-form notes |
| created_at, updated_at | TIMESTAMPTZ | Auto timestamps |

### generated_messages
Stores AI-generated outreach messages.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| prospect_id | UUID | FK to prospects |
| message_type | TEXT | `connection_request`, `follow_up_1`, `follow_up_2`, `comment` |
| content | TEXT | Generated message text |
| generated_at | TIMESTAMPTZ | When generated |
| used | BOOLEAN | Whether message was sent |

### engagement_posts
Posts fetched for comment engagement workflow.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| prospect_id | UUID | FK to prospects (CASCADE delete) |
| post_url | TEXT | **UNIQUE**, LinkedIn post URL |
| post_content | TEXT | Full post text |
| posted_at | TIMESTAMPTZ | When post was published |
| author_name | TEXT | Post author's name |
| author_photo_url | TEXT | Author's profile picture |
| status | TEXT | `active` or `archived` |
| archived_reason | TEXT | `aged` (2+ days old) or `engaged` (user commented) |
| generated_comments | JSONB | Array of 3 generated comment strings |
| created_at, updated_at | TIMESTAMPTZ | Auto timestamps |

### engagement_watched_profiles
Profiles to regularly fetch posts from.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| prospect_id | UUID | FK to prospects (**UNIQUE**) |
| added_at | TIMESTAMPTZ | When added to watch list |

---

## SQL to Create Tables

Run this in Supabase SQL Editor:

```sql
-- See lib/supabase.ts for full CREATE_TABLES_SQL
-- Key tables for engagement feature:

CREATE TABLE IF NOT EXISTS engagement_watched_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prospect_id)
);

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

CREATE INDEX IF NOT EXISTS idx_engagement_watched_profiles_prospect_id ON engagement_watched_profiles(prospect_id);
CREATE INDEX IF NOT EXISTS idx_engagement_posts_prospect_id ON engagement_posts(prospect_id);
CREATE INDEX IF NOT EXISTS idx_engagement_posts_status ON engagement_posts(status);
```

---

## API Endpoints

### Prospect Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prospects` | List all prospects with pipeline & messages |
| POST | `/api/prospects/bulk-delete` | Delete multiple prospects by IDs |
| POST | `/api/prospects/bulk-status` | Update status for multiple prospects |
| POST | `/api/prospects/recalculate-icp` | Recalculate ICP scores for all prospects |

### Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/import/linkedin` | Import profiles via Apify scraper |

**Request**: `{ urls: string[] }` (LinkedIn profile URLs)
**Response**: `{ success, prospects[], stats, debug }`

### Message Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/messages/generate` | Generate personalized messages |

**Request**: `{ prospect: Partial<Prospect> }`
**Response**: `{ messages: { connectionRequest, followUp1, followUp2 } }`

### Engagement (Post Commenting)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/engagement/watched-profiles` | List all watched profiles |
| POST | `/api/engagement/watched-profiles` | Add profile(s) - supports bulk via `linkedinUrls[]` |
| DELETE | `/api/engagement/watched-profiles/[id]` | Remove from watch list |
| POST | `/api/engagement/fetch-posts` | Fetch latest posts from watched profiles via Apify |
| POST | `/api/engagement/generate-comments` | Generate 3 comments per post |
| GET | `/api/engagement/posts?status=active\|archived` | List engagement posts |
| PATCH | `/api/engagement/posts/[id]` | Archive (`action: 'archive'`) or restore (`action: 'restore'`) |
| DELETE | `/api/engagement/clear-archived` | Permanently delete all archived posts |

---

## External Integrations

### Apify - Profile Scraping
**Actor**: `dev_fusion~linkedin-profile-scraper`

Used for importing LinkedIn profiles with full data (headline, about, experience, etc.)

### Apify - Post Scraping
**Actor**: `harvestapi~linkedin-profile-posts`

**Payload**:
```json
{
  "targetUrls": ["https://linkedin.com/in/person1", ...],
  "maxPosts": 1,
  "scrapeReactions": false,
  "scrapeComments": false,
  "includeQuotePosts": true,
  "includeReposts": true
}
```

**Async Pattern**:
1. POST to start run, get `runId`
2. Poll status every 5s until `SUCCEEDED` (max 2 minutes)
3. Fetch results from dataset

**Response Field Mapping** (handles variations):
- Post URL: `postUrl` | `url` | `link`
- Content: `text` | `postText` | `content`
- Date: `postedAt` | `postedDate` | `date` | `timestamp` | `postedAtTimestamp`
- Author: `authorName` | `author` | `fullName`

### OpenAI - Message/Comment Generation
**Model**: `gpt-4o`

Uses Isaac's voice profile (see below) to generate:
- Connection requests
- Follow-up messages (2 types)
- Comments on posts (3 variations per post)

---

## ICP Scoring Algorithm

Located in `lib/import.ts`. Determines segment (Agency/Merchant/Unknown) and scores decision-making authority + scale fit.

### Segments
| Segment | Description |
|---------|-------------|
| **Agency** | Shopify/e-commerce service providers (10-100 employees ideal) |
| **Merchant** | DTC brands shipping physical products (10-200 employees ideal) |
| **Unknown** | Freelancers or unclear fit |

### Scoring Breakdown

| Category | Points | Logic |
|----------|--------|-------|
| Title Authority | 0-40 | Decision-maker level based on segment |
| Company Signals | 0-35 | Keywords: Shopify Plus (+15), Shopify (+12), DTC (+10), e-commerce (+8) |
| Company Size Fit | -10 to +15 | Sweet spot bonuses, penalties for too small/large |
| Product Category | 0-10 | Electronics, jewelry, supplements, fashion, ceramics |
| Profile Completeness | 0-5 | Has about summary > 100 chars |

**Total**: Clamped to 0-100

### Title Scoring by Segment

**Agency Top Titles (40 pts)**: Founder, CEO, Co-founder, Owner, Managing Partner, Director of Partnerships

**Merchant Top Titles (40 pts)**: Founder, CEO, Co-founder, Owner, COO, VP of Operations, Head of E-commerce

**Secondary (25 pts)**: VPs, Directors, Heads of departments

**Tertiary (15 pts)**: Managers

---

## Isaac's Voice Profile

Located in `lib/voice-profile.ts`. Critical for authentic engagement.

### Rules

**NEVER use:**
- Exclamation points (`!`)
- Questions (end with statements)
- Emojis
- Hashtags
- Em-dashes
- Corporate jargon ("synergy", "leverage", "delighted")
- "I" as first word
- Words: "excited", "thrilled", "amazing", "awesome"

**ALWAYS:**
- Statements, not questions
- Operator-to-operator tone (peer, not salesy)
- Specific insights showing you read their content
- 15-40 word comments (concise but substantive)
- End with definitive statement

### Message Types

| Type | Purpose | Max Tokens |
|------|---------|------------|
| `connection_request` | Initial connection with personalized hook | 500 |
| `follow_up_1` | Value-add angle after connecting | 500 |
| `follow_up_2` | Soft close for call | 500 |
| `comment` | Engage with their LinkedIn posts | 300 |

---

## Pipeline Stages

```typescript
type PipelineStatus =
  | 'not_contacted'    // Default
  | 'visited'          // Profile visited
  | 'connection_sent'  // Request sent
  | 'connected'        // They accepted
  | 'message_sent'     // First message sent
  | 'responded'        // They replied
  | 'call_booked'      // Meeting scheduled
  | 'closed_won'       // Deal done
  | 'closed_lost';     // Not moving forward
```

---

## Page Features

### Main Dashboard (`/`)

**Views:**
- Grid view with prospect cards
- Pipeline (Kanban) view with drag-drop

**Features:**
- Filter by status, segment (Agency/Merchant/Freelancer), search
- Bulk selection mode (checkbox per card)
- Bulk delete selected prospects
- Bulk status change for selected
- "Recalculate ICP" button to rescore all
- Import: Excel, LinkedIn URLs, Manual entry
- Link to Engagement page

**Prospect Card Shows:**
- Profile pic, name, title, company
- Pipeline status badge
- Segment badge (Agency/Merchant/Freelancer)
- ICP score badge (color-coded: 70+ green, 40-69 yellow, <40 gray)
- LinkedIn link
- "Messages" indicator if generated

**Prospect Detail Modal:**
- Full profile info
- Career history
- ICP breakdown
- Generated messages with copy buttons
- Pipeline status dropdown
- Notes field

### Engagement Page (`/engagement`)

**Watched Profiles Section:**
- Add by URL (single or bulk paste)
- Shows profile chips with name, company, LinkedIn link, remove button
- "Fetch Posts" button to fetch from all watched

**Active Queue:**
- Posts from last 2 days
- Shows: Author, job title, company, time ago
- Post content preview (500 char max)
- 3 generated comment options with copy buttons
- "Open Post" button (opens LinkedIn)
- "Engaged" button (archives post)

**Archived Section:**
- Collapsed by default
- Shows archived posts with reason (Engaged/Aged Out)
- Restore individual posts
- Clear all archived

---

## Data Flow

### Import Flow
1. User adds LinkedIn URLs (bulk or single)
2. Apify scrapes full profile data
3. ICP score calculated from profile data
4. Prospect saved to Supabase with score breakdown
5. Pipeline status initialized as `not_contacted`

### Engagement Flow
1. User adds profiles to "Watched Profiles" list
2. Click "Fetch Posts" triggers Apify `linkedin-profile-posts` actor
3. Posts are matched to prospects by URL/username/name
4. Posts older than 2 days auto-archived with reason `aged`
5. Fresh posts saved, then 3 comments generated via OpenAI
6. User reviews comments, copies one, opens post on LinkedIn
7. After commenting, clicks "Engaged" to archive with reason `engaged`

### Message Generation Flow
1. User clicks "Generate Messages" in prospect detail
2. OpenAI called with Isaac's voice profile + prospect context
3. 3 message types generated in parallel
4. Messages saved to `generated_messages` table
5. User can copy and use on LinkedIn

---

## Key Conventions

- **LinkedIn URLs**: Normalized to lowercase, https prefix, no trailing slash
- **Profile matching**: Extracts username from URL for flexible matching
- **Local fallback**: App works without Supabase, shows "Local Only" badge
- **Batch operations**: Apify uses async polling, messages batch in groups of 5
- **Auto-archive**: Posts 2+ days old auto-archived when fetching new posts

---

## Current Status

### Complete
- Dashboard with grid and pipeline (Kanban) views
- Prospect detail modal with full profile display
- Excel import (WORKING + Scraped tabs)
- Bulk LinkedIn URL import via Apify
- ICP scoring with segment detection (Agency/Merchant/Freelancer)
- Segment filter and badges on cards
- Bulk selection, delete, and status change
- AI message generation (connection request + 2 follow-ups)
- Pipeline status tracking with timestamps
- Supabase persistence
- Engagement page with watched profiles
- Bulk add profiles to watch list
- Apify post fetching with async polling
- Auto-archive posts older than 2 days
- Comment generation (3 per post)
- Copy/Open Post/Mark as Engaged workflow
- Archive management (restore, clear all)
- Vercel deployment

### In Progress / Known Issues
- **Post fetch debugging**: Added detailed response logging - if no posts appear, check console for skip reasons (posts may be >2 days old, URL matching issues, or Apify returning different field names)
- Profile pictures may not load on Vercel due to next/image domain restrictions

### Future Enhancements
- Export to CSV/Excel
- Scheduled/automated post fetching
- Analytics dashboard (engagement rates, response rates)
- Integration with actual LinkedIn API (vs scraping)

---

## Deployment

- **GitHub**: quietst00rm/isaac-outreach-dashboard
- **Vercel**: Auto-deploys from main branch
- **Build**: `npm run build` (Next.js with Turbopack)
- **Environment**: Set all env vars in Vercel dashboard

---

## Troubleshooting

### "No active posts" after fetching
1. Check alert message for Apify return count
2. Open browser console (F12) for detailed `skippedDetails`
3. Common reasons:
   - "Post older than 2 days" - person hasn't posted recently
   - "Could not match to prospect" - URL format mismatch
   - "Missing URL/text" - Apify returned incomplete data

### Profiles not showing full data
- Apify scraper may return partial data
- Check console logs during import
- "Recalculate ICP" won't fix missing data, only rescores existing

### Supabase connection issues
- Verify env vars are set correctly
- Check Supabase dashboard for table creation
- App falls back to local state if Supabase unavailable
