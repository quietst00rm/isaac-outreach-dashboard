# Isaac Outreach Dashboard

LinkedIn outreach management system for Isaac Stern (Co-Founder of Parcelis). Single-user tool for managing prospects, generating personalized messages using Isaac's voice profile, and tracking pipeline status.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL) - optional, falls back to local state
- **AI**: OpenAI GPT-4o for message generation
- **Scraping**: Apify (`dev_fusion~linkedin-profile-scraper`) for LinkedIn profile import
- **Deployment**: Vercel
- **GitHub**: https://github.com/quietst00rm/isaac-outreach-dashboard

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main dashboard (grid/pipeline views)
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Tailwind imports
│   └── api/
│       ├── messages/generate/route.ts   # POST - Generate AI messages
│       └── import/linkedin/route.ts     # POST - Bulk import via Apify
├── components/
│   ├── index.ts              # Barrel exports
│   ├── ProspectCard.tsx      # Grid view card
│   ├── ProspectDetail.tsx    # Modal with full profile + messages
│   ├── PipelineBoard.tsx     # Kanban drag-drop view
│   ├── ImportModal.tsx       # Excel file import
│   ├── AddProspectModal.tsx  # Manual prospect entry
│   └── BulkUrlImportModal.tsx # LinkedIn URL import via Apify
├── lib/
│   ├── supabase.ts           # DB client + CRUD operations
│   ├── claude.ts             # OpenAI message generation
│   ├── voice-profile.ts      # Isaac's voice rules + prompts
│   └── import.ts             # Excel parsing + ICP scoring
└── types/
    └── index.ts              # All TypeScript interfaces
```

## Environment Variables

Required in `.env.local` and Vercel:

```
OPENAI_API_KEY=sk-proj-...           # GPT-4o for message generation
NEXT_PUBLIC_SUPABASE_URL=https://... # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... # Supabase anonymous key
APIFY_API_TOKEN=apify_api_...        # Apify for LinkedIn scraping
```

## Database Schema (Supabase)

### prospects
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| first_name, last_name, full_name | TEXT | Name fields |
| linkedin_url | TEXT | Unique, normalized URL |
| profile_pic_url | TEXT | Profile image URL |
| headline, about_summary | TEXT | LinkedIn bio |
| company_name, company_industry, company_size | TEXT | Company info |
| job_title, location | TEXT | Role info |
| career_history | JSONB | Array of Experience objects |
| recent_posts | JSONB | Array of RecentPost objects |
| icp_score | INTEGER | 0-100 calculated score |
| icp_score_breakdown | JSONB | Score by category |
| total_experience_years | NUMERIC | Years of experience |
| top_skills | TEXT | Comma-separated skills |
| created_at, updated_at | TIMESTAMPTZ | Timestamps |

### pipeline_status
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| prospect_id | UUID | FK to prospects (unique) |
| status | TEXT | Pipeline stage enum |
| visited_at, connection_sent_at, etc. | TIMESTAMPTZ | Stage timestamps |
| notes | TEXT | Free-form notes |

### generated_messages
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| prospect_id | UUID | FK to prospects |
| message_type | TEXT | connection_request, follow_up_1, follow_up_2, comment |
| content | TEXT | Generated message text |
| generated_at | TIMESTAMPTZ | When generated |
| used | BOOLEAN | Whether message was used |

## API Endpoints

### POST /api/messages/generate
Generates personalized messages using GPT-4o.

**Request**: `{ prospect: Partial<Prospect> }`

**Response**: `{ messages: { connectionRequest, followUp1, followUp2 } }`

### POST /api/import/linkedin
Imports profiles via Apify scraper.

**Request**: `{ urls: string[] }` (LinkedIn profile URLs)

**Response**: `{ success, prospects[], stats, debug }`

## ICP Scoring Algorithm

Located in `lib/import.ts`. Scores 0-100 based on:

| Category | Max Points | Criteria |
|----------|------------|----------|
| Industry | 30 | E-commerce, retail, DTC, fashion, electronics, etc. |
| Title | 25 | Founder, CEO, Owner, Director, VP, etc. |
| Agency | 20 | Bonus for Shopify agencies/partners |
| E-commerce Experience | 15 | Mentions Shopify, DTC, Amazon in about |
| Profile Completeness | 10 | Has about summary > 100 chars |

## Isaac's Voice Profile

Located in `lib/voice-profile.ts`. Key rules:

**Never use**: Exclamation points, questions, emojis, hashtags, em-dashes, corporate jargon

**Always**: Statements (not questions), operator-to-operator tone, specific insights, 15-40 word comments

**Prompts defined for**: connection_request, follow_up_1, follow_up_2, comment

## Pipeline Stages

```typescript
type PipelineStatus =
  | 'not_contacted'
  | 'visited'
  | 'connection_sent'
  | 'connected'
  | 'message_sent'
  | 'responded'
  | 'call_booked'
  | 'closed_won'
  | 'closed_lost';
```

## Data Flow

1. **Import prospects** via:
   - Excel upload (ImportModal) - parses WORKING/Scraped tabs
   - LinkedIn URLs (BulkUrlImportModal) - calls Apify API
   - Manual entry (AddProspectModal)

2. **ICP score calculated** on import using prospect data

3. **Prospects stored** in Supabase (if configured) or local React state

4. **Pipeline tracking** via drag-drop Kanban or dropdown in detail view

5. **Message generation** via "Generate Messages" button in ProspectDetail

## Key Conventions

- **LinkedIn URLs**: Normalized to lowercase, https, www, no trailing slash
- **Profile pictures**: Checked across 13+ field name variations from Apify
- **Local fallback**: App works without Supabase, shows "Local Only" badge
- **Batch operations**: Apify and message generation process in batches of 5

## Current Status

### Complete
- Dashboard with grid and pipeline (Kanban) views
- Prospect detail modal with full profile display
- Excel import (WORKING + Scraped tabs)
- Bulk LinkedIn URL import via Apify
- ICP scoring with breakdown display
- AI message generation (connection request + 2 follow-ups)
- Pipeline status tracking with timestamps
- Supabase persistence (optional)
- Profile picture import from Apify
- Vercel deployment

### Known Issues / TODOs
- Recent posts not yet scraped (Apify actor doesn't include them)
- Comment generation UI not implemented (backend ready)
- No batch message generation UI (function exists in lib/claude.ts)
- No export to CSV/Excel functionality
- Profile pictures may not load on Vercel due to next/image domain restrictions

### Deployment Notes
- GitHub repo: quietst00rm/isaac-outreach-dashboard
- Vercel auto-deploys from main branch
- Environment variables must be set in Vercel dashboard
- Build command: `npm run build`
- Output: Static + serverless functions
