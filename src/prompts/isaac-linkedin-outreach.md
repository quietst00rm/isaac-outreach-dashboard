---
name: isaac-linkedin-outreach
description: Generate personalized LinkedIn outreach messages for Isaac Stern (Co-founder of Parcelis). Use when creating connection requests, opening DMs, or follow-up messages for merchant or agency prospects. Handles bulk message generation from prospect data with fields like full_name, company_name, headline, job_title, about_summary, segment, and icp_score.
---

# Isaac Stern LinkedIn Outreach Generator

Generate personalized, on-brand LinkedIn messages for Isaac Stern's Parcelis outreach campaigns.

## Prospect Filtering

Before generating messages, filter prospects:

**Include only:**
- `segment` = "merchant" OR "agency"
- `icp_score` >= 50

**Exclude:**
- `segment` = "freelancer"
- `icp_score` < 50
- Empty `full_name` or `company_name`

## Message Types

Generate three message types per qualified prospect:

| Type | Purpose | Character Limit |
|------|---------|-----------------|
| `connection_request` | Get the accept | 300 max |
| `opening_dm` | First message after connection | 800 max |
| `follow_up` | Day 3-4 if no response | 400 max |

## Prospect Classification

Classify each prospect into ONE track based on available data:

### Track: OPERATOR_EXIT
**Criteria:** `segment` = "merchant" AND `about_summary` contains any of: "sold", "exit", "acquired", "acquisition", "founded and sold", "built and sold", "exited"
**Angle:** Peer credibility, Isaac's exit story, operator-to-operator

### Track: OPERATOR_SCALE
**Criteria:** `segment` = "merchant" AND (`company_size` contains "51-200" OR "201-500" OR "501-1000" OR `about_summary` contains "scaling", "growth", "grew", "million", "$M", "revenue")
**Angle:** Volume/scale focus, profit leak at scale, operational efficiency

### Track: OPERATOR_DTC
**Criteria:** `segment` = "merchant" AND `company_industry` contains any of: "Apparel", "Fashion", "Consumer", "Retail", "Beauty", "Food", "Beverage", "Wellness"
**Angle:** DTC-specific pain points, Truscope Golf reference, vertical expertise

### Track: AGENCY_PARTNER
**Criteria:** `segment` = "agency"
**Angle:** Partnership revenue, client value-add, recurring commission

### Track: GENERIC_MERCHANT
**Criteria:** `segment` = "merchant" AND no other track matched
**Angle:** Value-forward, brief, shipping protection problem awareness

## Personalization Extraction

Extract from `about_summary` and `headline` (in priority order):

1. **Specific achievement:** Numbers, revenue figures, years in business, company milestones
   - Pattern: "$X million", "X years", "grew from X to Y", "#1", "largest"
   
2. **Exit/acquisition reference:** If they sold or acquired companies
   - Pattern: "sold to", "acquired by", "exited", "founded and sold"
   
3. **Role context:** What they actually do day-to-day
   - Pattern: "I lead", "I run", "responsible for", "overseeing"

4. **Company positioning:** How they describe their company
   - Pattern: "premier", "leading", "fastest growing", "largest"

5. **Personal philosophy:** How they describe their approach
   - Pattern: "I believe", "passionate about", "driven by"

If `about_summary` is empty or under 50 characters, use `headline` only.

Store extracted hook as `personalization_hook` for use in templates.

## Voice Rules (Apply to ALL Messages)

**DO:**
- First person, conversational
- Direct and concise
- Reference Isaac's background naturally
- Use "I" not "we" for personal outreach
- End statements with periods, not questions (except follow-ups)

**DO NOT:**
- Use em-dashes (use commas or periods)
- Use exclamation points
- Use emojis
- Use "Hey there" or "Hi there" (use "Hey [NAME]")
- Use corporate jargon ("leverage", "synergize", "optimize")
- Use filler phrases ("I hope this finds you well", "I wanted to reach out")
- Ask questions at the end of opening messages (statements only)
- Mention profit/margin/revenue in any message (save for calls)

## Signature

All messages end with:
```
Isaac
```

No title. No company. Just the name.

---

## Message Templates by Track

### OPERATOR_EXIT

**connection_request:**
```
Hey {first_name}, I sold my company to Threecolts a couple years back. Saw you {personalization_hook}. Always good to connect with operators who've been through it.
```

**opening_dm:**
```
Hey {first_name},

Appreciate the connect.

I saw {personalization_hook}. That resonates. I built and sold Legacy Seller to Threecolts, then served as Head of Product post-acquisition. Now building Parcelis, shipping protection for Shopify merchants.

I'm also running a DTC brand myself (Truscope Golf), so I'm still in the operator trenches daily.

Would be good to swap notes sometime if you're open to it.

Isaac
```

**follow_up:**
```
Hey {first_name}, circling back. No pitch here, genuinely just looking to connect with other operators who've been through the exit process. Let me know if you're ever up for a quick chat.

Isaac
```

### OPERATOR_SCALE

**connection_request:**
```
Hey {first_name}, I work with Shopify merchants doing volume. {company_name} caught my attention. Would be good to connect.
```

**opening_dm:**
```
Hey {first_name},

Thanks for connecting.

I'm Isaac, co-founder of Parcelis. I sold my last company (Legacy Seller) to Threecolts and now we're focused on shipping protection for Shopify brands doing serious volume.

I noticed {personalization_hook}. At that scale, shipping issues tend to compound in ways that don't show up clearly on the P&L.

Running a DTC brand myself (Truscope Golf), I see this firsthand. Happy to share what we're learning if it's ever useful.

Isaac
```

**follow_up:**
```
Hey {first_name}, wanted to bump this up. I know operators at your level get pitched constantly. This isn't that. Just connecting with merchants doing volume in the Shopify ecosystem.

Isaac
```

### OPERATOR_DTC

**connection_request:**
```
Hey {first_name}, I run a DTC brand myself and work with Shopify merchants on shipping protection. {company_name} looks like a great operation.
```

**opening_dm:**
```
Hey {first_name},

Thanks for connecting.

I'm Isaac. I run Truscope Golf (DTC golf equipment) and co-founded Parcelis, which handles shipping protection for Shopify brands.

I noticed {personalization_hook}. {industry_reference}

Shipping issues hit DTC brands hard because the customer relationship is direct. No marketplace to hide behind. That's what got me focused on this space.

Happy to compare notes on what's working if you're ever interested.

Isaac
```

**follow_up:**
```
Hey {first_name}, following up. I know DTC operators are slammed. If shipping headaches ever become a priority, happy to share how other brands in the space are handling it.

Isaac
```

**industry_reference by company_industry:**
- Apparel/Fashion: "Apparel shipping has its own set of challenges, especially with returns and damage claims."
- Food/Beverage: "Perishable shipping is brutal. Temperature issues, timing, the whole thing."
- Beauty/Wellness: "Fragile products and high AOV make shipping issues expensive fast."
- Electronics: "High-value electronics are theft magnets. Porch piracy hits this category hard."
- Default: "Your vertical tends to see higher than average shipping issues."

### AGENCY_PARTNER

**connection_request:**
```
Hey {first_name}, I handle agency partnerships at Parcelis. We work with Shopify agencies on shipping protection. Would be good to connect.
```

**opening_dm:**
```
Hey {first_name},

Thanks for connecting.

I'm Isaac, co-founder of Parcelis. I handle all our agency partnerships personally because I want to make sure the structure actually works for both sides.

I noticed {personalization_hook}.

We're working with Shopify agencies on a partnership that creates value for their clients from day one, and recurring revenue for the agency. No cost to implement, no management burden on your team.

If partnerships are on your radar, happy to walk through how it works.

Isaac
```

**follow_up:**
```
Hey {first_name}, circling back on this. I know agencies get pitched constantly. Happy to keep this brief: 15 minutes to walk through the partnership structure, then you can decide if it fits. Let me know.

Isaac
```

### GENERIC_MERCHANT

**connection_request:**
```
Hey {first_name}, I work with Shopify merchants on shipping protection. Building in the e-commerce space and always looking to connect with operators.
```

**opening_dm:**
```
Hey {first_name},

Thanks for connecting.

I'm Isaac, co-founder of Parcelis. I sold my last company to Threecolts and now we're building shipping protection for Shopify merchants.

I also run a DTC brand myself (Truscope Golf), so I understand the operator life.

If shipping issues ever become a headache for {company_name}, happy to share what's working for other merchants.

Isaac
```

**follow_up:**
```
Hey {first_name}, just bumping this. If now isn't the right time, no worries. Happy to reconnect down the road.

Isaac
```

---

## Variable Substitution

| Variable | Source | Fallback |
|----------|--------|----------|
| `{first_name}` | First word of `full_name` | "there" (avoid if possible) |
| `{company_name}` | `company_name` field | Omit sentence if empty |
| `{personalization_hook}` | Extracted from `about_summary` or `headline` | Use generic: "your work in the {company_industry} space" |
| `{industry_reference}` | Mapped from `company_industry` | Use default |

## Quality Checks

Before outputting any message, verify:

1. **No em-dashes** anywhere in the message
2. **No exclamation points**
3. **No questions at end** of opening_dm (follow_up can have one)
4. **Under character limit** for message type
5. **First name extracted correctly** (not full name, not empty)
6. **Personalization hook is specific** (not just "your work")
7. **Ends with "Isaac"** on its own line

## Output Format

For each qualified prospect, output:

```json
{
  "prospect_id": "{id}",
  "full_name": "{full_name}",
  "company_name": "{company_name}",
  "track": "{assigned_track}",
  "personalization_hook": "{extracted_hook}",
  "messages": {
    "connection_request": "{message_text}",
    "opening_dm": "{message_text}",
    "follow_up": "{message_text}"
  }
}
```

## Edge Cases

**Empty about_summary:** Use headline for personalization. If headline is also generic (just a title), use: "your work at {company_name}"

**Very long names:** Use first name only. If first name is ambiguous (e.g., "Dr." or initials), use the second word.

**Missing company_name:** Skip prospect. Company context is required for quality outreach.

**ICP score exactly 50:** Include prospect but use GENERIC track unless clear signals exist.

**Multiple track matches:** Use first match in this priority order: OPERATOR_EXIT > AGENCY_PARTNER > OPERATOR_SCALE > OPERATOR_DTC > GENERIC_MERCHANT
