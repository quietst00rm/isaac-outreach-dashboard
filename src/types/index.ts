export type PipelineStatus =
  | 'not_contacted'
  | 'visited'
  | 'connection_sent'
  | 'connected'
  | 'message_sent'
  | 'responded'
  | 'call_booked'
  | 'closed_won'
  | 'closed_lost';

export type MessageType =
  | 'connection_request'
  | 'follow_up_1'
  | 'follow_up_2'
  | 'opening_dm'
  | 'follow_up'
  | 'comment';

// Track types for message classification (based on skill file)
export type MessageTrack =
  | 'OPERATOR_EXIT'
  | 'OPERATOR_SCALE'
  | 'OPERATOR_DTC'
  | 'AGENCY_PARTNER'
  | 'GENERIC_MERCHANT'
  | 'INFLUENCER_OUTREACH'
  | 'CONSULTANT_OUTREACH';

export interface Experience {
  companyName: string;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
}

export interface RecentPost {
  content: string;
  date: string;
  url?: string;
  engagement?: {
    likes: number;
    comments: number;
  };
}

export interface ICPScoreBreakdown {
  segment: 'agency' | 'merchant' | 'freelancer';
  titleAuthority: number;      // 0-40: Decision-making power (primary factor)
  companySignals: number;      // 0-35: Shopify/e-commerce keywords
  companySize: number;         // -10 to +15: Size fit penalty/bonus
  productCategory: number;     // 0-10: Minor boost for known categories
  profileCompleteness: number; // 0-5: Has about summary
  total: number;               // Max ~105, clamped to 0-100
}

export interface Prospect {
  id: string;
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
  careerHistory: Experience[];
  recentPosts: RecentPost[];
  icpScore: number;
  icpScoreBreakdown?: ICPScoreBreakdown;
  totalExperienceYears?: number;
  topSkills?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineRecord {
  id: string;
  prospectId: string;
  status: PipelineStatus;
  visitedAt?: string;
  connectionSentAt?: string;
  connectionAcceptedAt?: string;
  messageSentAt?: string;
  responseReceivedAt?: string;
  callBookedAt?: string;
  dealStatus?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedMessage {
  id: string;
  prospectId: string;
  messageType: MessageType;
  content: string;
  generatedAt: string;
  used: boolean;
}

export interface ProspectWithPipeline extends Prospect {
  pipeline?: PipelineRecord;
  messages?: GeneratedMessage[];
}

// For Excel import
export interface RawWorkingRow {
  'First Name': string;
  'Last Name': string;
  'LinkedIn URL': string;
  'Company': string;
  'Title': string;
  'About Summary'?: string;
  'Visited'?: boolean;
  'Date Visited'?: string;
  'Connection Request'?: boolean;
  'Date'?: string;
  'Status'?: string;
  'Connection Accepted'?: boolean;
  'Message Sent'?: boolean;
  'Notes / Personalization'?: string;
}

export interface RawScrapedRow {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  about?: string;
  companyName?: string;
  companyIndustry?: string;
  companySize?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  totalExperienceYears?: number;
  topSkillsByEndorsements?: string;
  addressWithCountry?: string;
  profilePic?: string;
  profilePicHighQuality?: string;
  'experiences/0/companyName'?: string;
  'experiences/0/title'?: string;
  'experiences/0/jobDescription'?: string;
  'experiences/1/companyName'?: string;
  'experiences/1/title'?: string;
  'experiences/1/jobDescription'?: string;
  'experiences/2/companyName'?: string;
  'experiences/2/title'?: string;
  'experiences/2/jobDescription'?: string;
}

// Filter/sort options
export type SegmentFilter = 'agency' | 'merchant' | 'freelancer' | 'all';

export interface FilterOptions {
  status?: PipelineStatus | 'all';
  segment?: SegmentFilter;
  industry?: string;
  search?: string;
  icpScoreMin?: number;
}

export type SortField = 'name' | 'company' | 'icpScore' | 'lastActivity' | 'status';
export type SortDirection = 'asc' | 'desc';

// Engagement posts for commenting workflow
export interface EngagementPost {
  id: string;
  prospectId: string;
  postUrl: string;
  postContent: string;
  postedAt: string;
  authorName: string;
  authorPhotoUrl?: string;
  status: 'active' | 'archived';
  archivedReason?: 'aged' | 'engaged';
  generatedComments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EngagementPostWithProspect extends EngagementPost {
  prospect?: Prospect;
}

// Watched profiles for regular engagement
export interface WatchedProfile {
  id: string;
  prospectId: string;
  addedAt: string;
}

export interface WatchedProfileWithProspect extends WatchedProfile {
  prospect?: Prospect;
}

// Response Generator Types
export type ResponseClassification =
  // Positive
  | 'problem_aware'
  | 'curious'
  | 'hot_lead'
  // Neutral
  | 'non_committal'
  | 'deflecting'
  | 'asking_who_you_are'
  // Negative
  | 'not_interested'
  | 'has_competitor'
  | 'wrong_target'
  | 'hard_no';

export interface ResponseOption {
  style: 'direct' | 'soft' | 'question_first';
  content: string;
}

export interface GeneratedResponse {
  classification: ResponseClassification;
  classificationConfidence: number; // 0-100
  recommendedAction: string;
  responses: ResponseOption[];
  shouldEscalate: boolean;
  escalationReason?: string;
}

export interface ResponseInteraction {
  id: string;
  prospectId: string;
  prospectResponse: string;
  classification: ResponseClassification;
  classificationOverridden: boolean;
  originalClassification?: ResponseClassification;
  generatedResponses: ResponseOption[];
  selectedResponse?: string;
  selectedStyle?: 'direct' | 'soft' | 'question_first';
  outcome?: 'positive' | 'neutral' | 'negative' | 'no_reply';
  createdAt: string;
  updatedAt: string;
}
