# Isaac Outreach Dashboard

LinkedIn lead management and outreach system for Parcelis. Built with Next.js, Tailwind CSS, and OpenAI API for AI-powered message generation.

## Features

- **Import Prospects**: Upload Excel files with LinkedIn prospect data (supports "WORKING" and "Scraped" tabs)
- **Prospect Cards**: View prospects in a grid with key info at a glance
- **Pipeline View**: Kanban-style drag-and-drop pipeline management
- **ICP Scoring**: Automatic scoring based on industry, title, and e-commerce experience
- **AI Message Generation**: Generate personalized outreach messages using Claude API with Isaac's voice profile
- **Status Tracking**: Track prospect status through the outreach funnel

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and add your API keys:

```env
# Required for message generation
OPENAI_API_KEY=your_openai_api_key_here

# Optional - for persistent storage
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

## Usage

### Importing Prospects

1. Click the "Import" button in the header
2. Drag and drop your Excel file or click to browse
3. The system will parse the "WORKING" tab (for pipeline status) and "Scraped" tab (for profile data)
4. Review the preview and click "Import"

### Viewing Prospects

- **Grid View**: See all prospects as cards with key info
- **Pipeline View**: Kanban board showing prospects by status
- Use search and status filters to find specific prospects

### Generating Messages

1. Click on a prospect card to open the detail view
2. Click "Generate" to create personalized outreach messages
3. Messages are generated in Isaac's voice:
   - Connection Request (under 300 chars)
   - Follow-up #1 (value-add angle)
   - Follow-up #2 (soft close)
4. Click the copy icon to copy messages to clipboard

### Managing Pipeline

- In Pipeline View, drag prospects between columns to update status
- In Grid View, open a prospect and use the status dropdown
- Status options: Not Contacted → Visited → Connection Sent → Connected → Message Sent → Responded → Call Booked

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **AI**: OpenAI API (GPT-4o)
- **Excel Parsing**: SheetJS (xlsx)
- **Deployment**: Vercel

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main dashboard
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── api/
│       └── messages/
│           └── generate/     # Message generation API
├── components/
│   ├── ProspectCard.tsx      # Prospect card component
│   ├── ProspectDetail.tsx    # Prospect detail modal
│   ├── PipelineBoard.tsx     # Kanban pipeline view
│   └── ImportModal.tsx       # Excel import modal
├── lib/
│   ├── supabase.ts           # Supabase client
│   ├── claude.ts             # Claude API integration
│   ├── voice-profile.ts      # Isaac's voice rules
│   └── import.ts             # Excel parsing utilities
└── types/
    └── index.ts              # TypeScript types
```

## Deploying to Vercel

1. Push your code to a Git repository
2. Import the project in Vercel
3. Add environment variables in Vercel project settings:
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL` (optional)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional)
4. Deploy

## Isaac's Voice Profile

Messages are generated following Isaac Stern's voice profile:
- **Operator-focused**: Speaks from experience running businesses
- **Direct**: No fluff, gets to the point
- **Results-oriented**: Numbers and outcomes matter
- **No exclamation points**: Period only
- **No questions**: Make statements instead
- **No emojis or hashtags**

See `src/lib/voice-profile.ts` for the complete voice guidelines.
