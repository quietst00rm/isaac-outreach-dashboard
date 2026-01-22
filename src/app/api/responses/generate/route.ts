import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { Prospect, ResponseClassification, GeneratedResponse, ResponseOption } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Classification descriptions for the AI
const CLASSIFICATION_GUIDE = `
## RESPONSE CLASSIFICATIONS

### Positive Responses

**problem_aware** - They confirmed the pain point exists
- Examples: "Yeah actually we deal with that a lot", "Route's been a nightmare", "It's definitely a headache"
- Signal: They have the problem and are open to discussing it

**curious** - They're asking questions or want to know more
- Examples: "How does that work?", "Tell me more", "What do you mean?"
- Signal: Interested but vetting before committing

**hot_lead** - They're actively looking or the timing is perfect
- Examples: "Funny timing, we were just discussing this", "We've been evaluating options"
- Signal: They're in buying mode. Move fast.

### Neutral Responses

**non_committal** - Vague, neither yes nor no
- Examples: "Sometimes", "Depends", "I guess", "Here and there"
- Signal: Not sure if it's a big enough problem. Need to make pain concrete.

**deflecting** - Pointing to someone else
- Examples: "That's more of an ops question", "You should talk to our fulfillment team"
- Signal: Wrong person, but potentially helpful. Get the referral.

**asking_who_you_are** - Wants to know your angle
- Examples: "What do you do?", "Is this a sales thing?", "Why do you ask?"
- Signal: Guarded but engaged. Be honest.

### Negative Responses

**not_interested** - Polite decline
- Examples: "Not interested", "We're good", "Not a priority right now"
- Signal: Door closing but not slammed. Exit gracefully, leave door open.

**has_competitor** - They already use Route, InsureShield, Navidium, etc.
- Examples: "We use Route", "We're on InsureShield", "We self-insure"
- Signal: OPPORTUNITY. They have the problem. Probe for pain with their current solution.

**wrong_target** - Doesn't fit our ICP
- Examples: "We don't ship physical products", "We're not on Shopify"
- Signal: Mismatch. Exit quickly and politely.

**hard_no** - Hostile or explicit rejection
- Examples: "Stop messaging me", "Remove me from your list"
- Signal: Done. Mark as do-not-contact. No follow-up ever.
`;

// Response rules for each classification
const RESPONSE_RULES: Record<ResponseClassification, string> = {
  problem_aware: `
## problem_aware → Value Drop + Soft Ask for Call
- Validate their pain briefly (1 sentence)
- Give a quick intro to Parcelis (2 sentences max)
- Offer a call without being pushy
- Mention the specific benefit relevant to their segment (agencies vs merchants)

For AGENCIES: Talk about their CLIENTS, mention $0.10 per insured package recurring revenue
For MERCHANTS: Talk about THEIR margins, mention they keep the markup as profit
`,

  curious: `
## curious → Educate + Value Drop + Soft Ask
- Answer their question directly first
- Include one concrete stat ($15.7B porch piracy, 79% customer loss, etc.)
- Pivot to asking about their situation
- Offer a call
`,

  hot_lead: `
## hot_lead → Book the Call Directly
- Mirror their urgency
- Ask what triggered the timing
- Send calendar link immediately: [CALENDAR_LINK]
- Keep it brief, they're ready
`,

  non_committal: `
## non_committal → Ask Another Question to Amplify Pain
- Share a specific stat or quick story to make the problem concrete
- Ask if they see something similar
- Do NOT pitch yet
- Keep probing to uncover if there's real pain
`,

  deflecting: `
## deflecting → Get the Referral
- Thank them
- Ask for the right person's name
- Offer to mention they referred you
- Exit gracefully if they don't provide
`,

  asking_who_you_are: `
## asking_who_you_are → Honest Answer + Question Back
- Be direct that you're co-founder of a shipping protection company
- Explain briefly why you reached out to them specifically
- Ask a question to turn it back into a conversation
- Don't be defensive or salesy
`,

  not_interested: `
## not_interested → Exit Gracefully
- Acknowledge their response
- Leave door open for future ("If that ever changes, door's open")
- Do NOT push back, guilt trip, or ask why
- Maximum 2 sentences
`,

  has_competitor: `
## has_competitor → Plant Doubt Seed with Questions
- Do NOT bash the competitor
- Ask a probing question about their experience with that competitor

Specific questions by competitor:
- Route: "How's the support been?" or "Do you know what you're actually making off it?"
- InsureShield: "Have your rates gone up since you started filing claims?"
- Navidium/Captain: "What's your plan if you have a really bad month? Stolen truck, holiday spike, etc."

If they mention problems, you can pivot to "We built Parcelis specifically because of that..."
`,

  wrong_target: `
## wrong_target → Quick Exit
- Brief apology for the mismatch
- One sentence max
- No follow-up
`,

  hard_no: `
## hard_no → Immediate Exit
- Output ONLY: "Understood. Removed."
- Nothing else. No pleasantries.
`
};

// Build the classification prompt
function buildClassificationPrompt(prospectResponse: string): string {
  return `You are classifying a prospect's response to LinkedIn outreach for Parcelis (shipping protection for e-commerce).

${CLASSIFICATION_GUIDE}

## PROSPECT'S RESPONSE
"${prospectResponse}"

## TASK
Classify this response into exactly ONE of these categories:
- problem_aware
- curious
- hot_lead
- non_committal
- deflecting
- asking_who_you_are
- not_interested
- has_competitor
- wrong_target
- hard_no

Return ONLY a JSON object in this exact format:
{
  "classification": "the_category",
  "confidence": 85,
  "reasoning": "Brief explanation of why this classification"
}`;
}

// Build the response generation prompt
function buildResponsePrompt(
  prospect: Partial<Prospect>,
  prospectResponse: string,
  classification: ResponseClassification
): string {
  const segment = prospect.icpScoreBreakdown?.segment || 'merchant';
  const isAgency = segment === 'agency';

  const segmentContext = isAgency
    ? `
## SEGMENT: AGENCY
- Talk about their CLIENTS, not them directly
- Emphasize: agencies earn $0.10 per insured package across their entire client portfolio (recurring passive revenue)
- Pain points to reference: Route's AI support making agencies look bad, apps that break client stores, no referral revenue from current solutions
- Frame calls as: "portfolio review" or "walk through the agency model"
`
    : `
## SEGMENT: MERCHANT
- Talk about THEIR margin and THEIR operations
- Emphasize: you set the customer price, you keep the markup as profit
- Pain points to reference: eating replacement costs, $25-70 per WISMO ticket, 30-60 day carrier claim resolution
- Frame calls as: "run the numbers for your volume" or "15 minutes to show the model"
`;

  return `You are generating reply options for a LinkedIn conversation for Isaac Stern, co-founder of Parcelis.

## PARCELIS CONTEXT
- Shipping protection for e-commerce (primarily Shopify)
- Backed by The Hartford (Fortune 500 insurer)
- Differentiator: merchants set their own customer price and keep the markup as profit
- Zero merchant involvement in claims - customer files direct, Parcelis handles everything
- 5-7 day claim resolution (vs 30-60 for carriers)
- Human support (no AI loops like Route)
- No long-term contracts (unlike Route's 24-month non-competes)
- For agencies: recurring revenue of $0.10 per insured package across their client portfolio

## KEY STATS TO REFERENCE
- $15.7B lost to porch piracy in 2024
- 250,000 packages stolen daily
- $25-70 cost per WISMO support ticket
- 79% of customers won't return after a bad delivery experience
- 43% average opt-in rate for shipping protection
- 5-7 day claim resolution (vs 30-60 for carrier claims)
- Route keeps 100% of premiums (merchants get $0)

${segmentContext}

## PROSPECT CONTEXT
Name: ${prospect.firstName || prospect.fullName?.split(' ')[0] || 'there'}
Company: ${prospect.companyName || 'their company'}
Title: ${prospect.jobTitle || 'Unknown'}
Industry: ${prospect.companyIndustry || 'E-commerce'}
ICP Score: ${prospect.icpScore || 'Unknown'}

## THEIR RESPONSE
"${prospectResponse}"

## CLASSIFICATION
${classification}

## RULES FOR THIS CLASSIFICATION
${RESPONSE_RULES[classification]}

## MESSAGE RULES (CRITICAL - FOLLOW EXACTLY)
- Maximum 4 sentences per response
- Conversational like a text message, not an email
- No bullet points or fancy formatting
- No signatures ("Best," "Thanks," etc.)
- No links except [CALENDAR_LINK] placeholder when asking for a call

## FORBIDDEN PHRASES (NEVER USE)
- "hidden money" / "profit leaks" / "untapped revenue"
- "synergies" / "align" / "leverage"
- "I hope this finds you well"
- "Just following up" / "Circling back"
- "I'd love to"
- "Happy to help"
- "Does that make sense?"
- Any em-dashes (—)

## OUTPUT FORMAT
Generate exactly 3 response options (unless classification is hard_no or wrong_target, then just 1).

Return a JSON object:
{
  "responses": [
    {"style": "direct", "content": "Most assertive appropriate response"},
    {"style": "soft", "content": "Lower pressure version"},
    {"style": "question_first", "content": "Leads with a question before any value statement"}
  ],
  "recommendedAction": "Brief description of what to do next"
}

For hard_no: Return only {"responses": [{"style": "direct", "content": "Understood. Removed."}], "recommendedAction": "Mark as do-not-contact. No follow-up ever."}
For wrong_target: Return only one brief response.

Generate the responses now:`;
}

// Check for escalation triggers
function checkEscalation(
  prospect: Partial<Prospect>,
  prospectResponse: string,
  classification: ResponseClassification
): { shouldEscalate: boolean; reason?: string } {
  const reasons: string[] = [];
  const responseLower = prospectResponse.toLowerCase();
  const segment = prospect.icpScoreBreakdown?.segment;
  const icpScore = prospect.icpScore || 0;

  // Hot lead always escalates
  if (classification === 'hot_lead') {
    reasons.push('Hot lead - actively looking');
  }

  // High ICP score
  if (icpScore >= 80) {
    reasons.push(`High ICP score (${icpScore})`);
  }

  // Positive agency response
  if (segment === 'agency' && ['problem_aware', 'curious', 'hot_lead'].includes(classification)) {
    reasons.push('Positive agency response');
  }

  // Keywords indicating high intent
  const highIntentKeywords = ['evaluating', 'rfp', 'budget approved', 'decision maker', 'looking at options'];
  for (const keyword of highIntentKeywords) {
    if (responseLower.includes(keyword)) {
      reasons.push(`High-intent keyword: "${keyword}"`);
      break;
    }
  }

  // Volume mentions
  const volumeMatch = responseLower.match(/(\d+[,.]?\d*)\s*(k|thousand|packages?|orders?|shipments?)/i);
  if (volumeMatch) {
    const numStr = volumeMatch[1].replace(',', '');
    const num = parseFloat(numStr);
    const multiplier = volumeMatch[2].toLowerCase().startsWith('k') ? 1000 : 1;
    if (num * multiplier >= 5000) {
      reasons.push(`High volume mentioned (${volumeMatch[0]})`);
    }
  }

  return {
    shouldEscalate: reasons.length > 0,
    reason: reasons.length > 0 ? reasons.join('; ') : undefined
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prospect, prospectResponse } = body as {
      prospect: Partial<Prospect>;
      prospectResponse: string;
    };

    if (!prospect || !prospectResponse) {
      return NextResponse.json(
        { error: 'Prospect data and response text are required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Step 1: Classify the response
    const classificationResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 200,
      temperature: 0.3, // Lower temperature for more consistent classification
      messages: [
        {
          role: 'system',
          content: 'You are a response classifier for sales outreach. Return ONLY valid JSON.'
        },
        {
          role: 'user',
          content: buildClassificationPrompt(prospectResponse)
        }
      ]
    });

    const classificationContent = classificationResponse.choices[0]?.message?.content;
    if (!classificationContent) {
      throw new Error('No classification response from OpenAI');
    }

    let classificationResult: {
      classification: ResponseClassification;
      confidence: number;
      reasoning: string;
    };

    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = classificationContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in classification response');
      }
      classificationResult = JSON.parse(jsonMatch[0]);
    } catch {
      console.error('Failed to parse classification:', classificationContent);
      throw new Error('Failed to parse classification response');
    }

    const classification = classificationResult.classification;

    // Step 2: Check escalation triggers
    const escalation = checkEscalation(prospect, prospectResponse, classification);

    // Step 3: Generate response options
    const responseGeneration = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: 'You are a response generator for LinkedIn sales conversations. Return ONLY valid JSON. Keep responses conversational and brief.'
        },
        {
          role: 'user',
          content: buildResponsePrompt(prospect, prospectResponse, classification)
        }
      ]
    });

    const responseContent = responseGeneration.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response generation from OpenAI');
    }

    let generatedResponses: {
      responses: ResponseOption[];
      recommendedAction: string;
    };

    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      generatedResponses = JSON.parse(jsonMatch[0]);
    } catch {
      console.error('Failed to parse responses:', responseContent);
      throw new Error('Failed to parse response generation');
    }

    // Build final result
    const result: GeneratedResponse = {
      classification,
      classificationConfidence: classificationResult.confidence,
      recommendedAction: generatedResponses.recommendedAction,
      responses: generatedResponses.responses,
      shouldEscalate: escalation.shouldEscalate,
      escalationReason: escalation.reason
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating response:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate response' },
      { status: 500 }
    );
  }
}
