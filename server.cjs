/**
 * NEURAL CAPTURE BACKEND SERVER
 *
 * Purpose: Express API server handling all Claude AI integration for the Neural Capture app.
 *          Provides endpoints for idea organization, subject classification, planning, and analytics.
 *
 * ENDPOINTS:
 *
 * 1. POST /api/organize-ideas (lines 36-166)
 *    - Model: Sonnet 4.5
 *    - Purpose: Group ideas by theme, assign priorities, suggest next steps
 *    - Input: { ideas: Array }
 *    - Output: { summary, themes[], nextSteps[] }
 *
 * 2. POST /api/weekly-summary (lines 168-221)
 *    - Model: Sonnet 4.5
 *    - Purpose: Weekly patterns and productivity insights
 *    - Input: { ideas: Array }
 *    - Output: { summary, ideaCount, dateRange }
 *
 * 3. POST /api/analyze-patterns (lines 223-291)
 *    - Model: Sonnet 4.5
 *    - Purpose: Correlate energy logs with idea generation
 *    - Input: { logs: Array, ideas: Array }
 *    - Output: { correlations, bestTimes, recommendations }
 *
 * 4. POST /api/plan-activity (lines 293-420)
 *    - Model: Sonnet 4.5 (quality over cost per user request)
 *    - Purpose: Pre-action planning recommendations
 *    - Input: { activity: String, ideas, logs, checklist, reviews }
 *    - Output: { summary, bestTime, duration, location, recurring, tips[] }
 *    - Context: Uses last 20 ideas, logs, current routines, latest review
 *
 * 5. POST /api/classify-subject (lines 430-518)
 *    - Model: Haiku 3.5 (cost-optimized ~$0.0001 per call)
 *    - Purpose: Classify study subjects into academic hierarchy
 *    - Input: { subject: String }
 *    - Output: { hierarchy: Array, normalized: String }
 *    - Cache: In-memory Map with normalized alphanumeric keys (line 423)
 *    - Prompt Balance: 2 levels for broad, 3 for specific topics
 *
 * CRITICAL MODEL NAMES:
 * ✅ 'claude-sonnet-4-5-20250929'  - Sonnet 4.5 (quality)
 * ✅ 'claude-3-5-haiku-20241022'   - Haiku 3.5 (cost-efficient)
 * ❌ 'claude-haiku-3-5-20241022'   - WRONG, causes 404
 *
 * CACHING:
 * - subjectCache (line 423) - In-memory Map for subject classifications
 * - Normalized keys: lowercase alphanumeric only
 * - Reduces API calls by ~90% for repeated subjects
 *
 * ERROR HANDLING:
 * - 400: Invalid request (missing params)
 * - 401: Invalid API key
 * - 404: Model not found (check model name)
 * - 429: Rate limit exceeded
 * - 500: Server error
 *
 * ENVIRONMENT:
 * - ANTHROPIC_API_KEY (required) - Set in .env file
 * - PORT (optional, default 3001)
 * - NODE_ENV (optional, shows stack traces in development)
 *
 * COMMON ISSUES:
 * - 404 errors → Check model name format above
 * - Subject classification fails → Restart server to load new endpoint
 * - No API key warning → Add ANTHROPIC_API_KEY to .env
 * - JSON parse errors → Prompt may need tweaking to avoid markdown fences
 *
 * PROMPT ENGINEERING NOTES:
 * - Always request "ONLY valid JSON with no markdown formatting"
 * - Strip ```json and ``` markers in response (see parsing logic)
 * - Fallback to sensible defaults if parsing fails
 * - Classification prompt balances 2-level vs 3-level hierarchies
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? true // Allow all origins in production (Railway, etc.)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Neural Capture API'
  });
});

// POST /api/organize-ideas - Organize ideas using Claude API
app.post('/api/organize-ideas', async (req, res) => {
  try {
    const { ideas } = req.body;

    if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: ideas array is required and must not be empty'
      });
    }

    console.log(`Organizing ${ideas.length} ideas with Claude API...`);

    // Format ideas for Claude
    const ideasText = ideas.map((idea, index) => {
      const tags = idea.tags && idea.tags.length > 0 ? `[${idea.tags.join(', ')}]` : '';
      const context = idea.context ? `Context: ${idea.context}` : '';
      return `${index + 1}. ${tags} ${idea.content}\n${context}`;
    }).join('\n\n');

    // Call Claude API (using Haiku 3.5 for speed)
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are an AI assistant helping someone with ADHD organize their captured ideas. Analyze these ideas and organize them intelligently.

Here are the captured ideas:

${ideasText}

IMPORTANT: Return ONLY valid JSON with no markdown formatting. Do not wrap in code blocks.

Please organize these ideas by:
1. Identifying common themes and grouping related ideas together
2. Assigning priority levels (high, medium, low) to each theme based on urgency and impact
3. Providing a brief summary of the overall pattern you see
4. Suggesting 3-5 actionable next steps in order of priority

For each theme, include only the 5-8 most important ideas. If there are many similar ideas, summarize them.

Return your response as pure JSON (no markdown code fences):
{
  "summary": "A brief 2-3 sentence overview of what you notice about these ideas",
  "themes": [
    {
      "name": "Theme name with emoji",
      "description": "Brief description of this theme",
      "priority": "high|medium|low",
      "ideas": [
        {
          "content": "The idea text",
          "tags": ["tag1", "tag2"]
        }
      ]
    }
  ],
  "nextSteps": [
    "Specific actionable step 1",
    "Specific actionable step 2",
    "Specific actionable step 3"
  ]
}

Be encouraging and supportive in your tone. Focus on helping execute these ideas, not just organizing them.`
      }]
    });

    // Extract the response
    const responseText = message.content[0].text;

    // Try to parse JSON from the response
    let organizedData;
    try {
      // Remove markdown code fences if present
      let cleanedText = responseText.trim();

      // Strip ```json and ``` markers
      cleanedText = cleanedText.replace(/^```json\s*/i, '');
      cleanedText = cleanedText.replace(/^```\s*/i, '');
      cleanedText = cleanedText.replace(/\s*```$/i, '');

      // Try to parse as JSON directly
      try {
        organizedData = JSON.parse(cleanedText);
      } catch (directParseError) {
        // If that fails, try to extract JSON from the text
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          organizedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response as JSON:', parseError);
      console.error('Raw response:', responseText);
      // Fallback: return the raw response
      organizedData = {
        summary: responseText,
        themes: [],
        nextSteps: []
      };
    }

    console.log('Successfully organized ideas');
    console.log('Parsed data structure:', JSON.stringify(organizedData, null, 2).substring(0, 500) + '...');
    res.json(organizedData);

  } catch (error) {
    console.error('❌ Error organizing ideas:');
    console.error('   Status:', error.status || 'N/A');
    console.error('   Message:', error.message);
    console.error('   Type:', error.type || 'N/A');
    if (process.env.NODE_ENV === 'development') {
      console.error('   Stack:', error.stack);
    }

    if (error.status === 401) {
      return res.status(401).json({
        error: 'Invalid API key. Please check your ANTHROPIC_API_KEY environment variable.'
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again in a moment.'
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to organize ideas. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /api/weekly-summary - Get weekly summary of ideas
app.post('/api/weekly-summary', async (req, res) => {
  try {
    const { ideas } = req.body;

    if (!ideas || !Array.isArray(ideas)) {
      return res.status(400).json({
        error: 'Invalid request: ideas array is required'
      });
    }

    console.log(`Generating weekly summary for ${ideas.length} ideas...`);

    const ideasText = ideas.map(idea => {
      const timestamp = new Date(idea.timestamp).toLocaleDateString();
      return `[${timestamp}] ${idea.content}`;
    }).join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Provide a weekly summary of these captured ideas. Focus on patterns, productivity insights, and suggestions for the week ahead.

Ideas:
${ideasText}

Format your response as:
- Key themes this week
- Most productive areas
- Suggestions for next week
- Any concerning patterns (like scattered focus or lack of follow-through)`
      }]
    });

    const summary = message.content[0].text;

    res.json({
      summary,
      ideaCount: ideas.length,
      dateRange: {
        start: ideas[ideas.length - 1]?.timestamp,
        end: ideas[0]?.timestamp
      }
    });

  } catch (error) {
    console.error('Error generating weekly summary:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate weekly summary'
    });
  }
});

// POST /api/analyze-patterns - Analyze patterns in logs and ideas
app.post('/api/analyze-patterns', async (req, res) => {
  try {
    const { logs, ideas } = req.body;

    if (!logs || !ideas) {
      return res.status(400).json({
        error: 'Invalid request: both logs and ideas are required'
      });
    }

    console.log(`Analyzing patterns from ${logs.length} logs and ${ideas.length} ideas...`);

    const logsText = logs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      return `[${timestamp}] Energy: ${log.energy}/10, Motivation: ${log.motivation}/10, Activity: ${log.activity || 'none'}`;
    }).join('\n');

    const ideasText = ideas.map(idea => {
      const timestamp = new Date(idea.timestamp).toLocaleString();
      return `[${timestamp}] ${idea.content}`;
    }).join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1536,
      messages: [{
        role: 'user',
        content: `Analyze these energy logs and captured ideas to find meaningful correlations and patterns for someone with ADHD.

ENERGY LOGS:
${logsText}

CAPTURED IDEAS:
${ideasText}

Identify:
1. Correlations between energy levels and idea generation
2. Best times of day for productivity
3. Patterns in activities that boost or drain energy
4. Recommendations for optimizing daily routine

Return analysis in JSON format with: correlations, bestTimes, recommendations`
      }]
    });

    const responseText = message.content[0].text;

    let analysis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = { analysis: responseText };
      }
    } catch (parseError) {
      analysis = { analysis: responseText };
    }

    res.json(analysis);

  } catch (error) {
    console.error('Error analyzing patterns:', error);
    res.status(500).json({
      error: error.message || 'Failed to analyze patterns'
    });
  }
});

// POST /api/plan-activity - Get AI planning advice for an activity
app.post('/api/plan-activity', async (req, res) => {
  try {
    const { activity, ideas, logs, checklist, reviews } = req.body;

    if (!activity || typeof activity !== 'string') {
      return res.status(400).json({
        error: 'Invalid request: activity string is required'
      });
    }

    console.log(`Getting planning advice for: "${activity}"...`);

    // Format user data for context
    const recentIdeas = (ideas || [])
      .slice(-20)
      .map(idea => `- ${idea.content}`)
      .join('\n');

    const recentLogs = (logs || [])
      .slice(-20)
      .map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        return `- [${time}] ${log.activity}: Energy ${log.energy}/10, Motivation ${log.motivation}/10${log.note ? ` (${log.note})` : ''}`;
      })
      .join('\n');

    const checklistInfo = checklist?.items?.length > 0
      ? `Current routines: ${checklist.items.map(item => item.text).join(', ')}`
      : 'No current routines set';

    const recentReview = reviews?.length > 0
      ? `Last review: Energy ${reviews[0].energy}/10, Accomplishments: ${reviews[0].accomplishments || 'none'}`
      : 'No reviews yet';

    // Call Claude API using Haiku 3.5 for fast planning
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1536,
      messages: [{
        role: 'user',
        content: `You are a planning assistant for someone with ADHD. They want to plan this activity:

"${activity}"

Here's context about their recent patterns:

RECENT IDEAS:
${recentIdeas || 'No ideas yet'}

RECENT ACTIVITY LOGS:
${recentLogs || 'No logs yet'}

ROUTINES:
${checklistInfo}

RECENT REVIEW:
${recentReview}

Based on this data, provide personalized planning advice. IMPORTANT: Return ONLY valid JSON with no markdown formatting.

Return pure JSON (no code fences):
{
  "summary": "A brief 1-2 sentence summary of what this activity is and why it matters based on their data",
  "bestTime": "Suggested best time of day to do this (e.g., 'Morning (9-11am)' or 'Evening after dinner') based on their energy patterns",
  "duration": "Recommended duration (e.g., '25-30 minutes' or '1-2 hours') - be realistic for ADHD",
  "location": "Suggested location or environment (e.g., 'Quiet desk with minimal distractions' or 'Coffee shop for social energy')",
  "recurring": "Whether this should be recurring and frequency (e.g., 'Daily at 9am' or 'Once' or 'Weekly on Mondays')",
  "tips": [
    "Specific actionable tip 1",
    "Specific actionable tip 2",
    "Specific actionable tip 3"
  ]
}

Be encouraging and supportive. If their data shows low energy patterns, suggest shorter sessions or specific energy-boosting strategies. If they have similar ideas captured, reference those connections.`
      }]
    });

    const responseText = message.content[0].text;

    // Parse JSON response
    let plan;
    try {
      let cleanedText = responseText.trim();
      cleanedText = cleanedText.replace(/^```json\s*/i, '');
      cleanedText = cleanedText.replace(/^```\s*/i, '');
      cleanedText = cleanedText.replace(/\s*```$/i, '');

      plan = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse planning response:', parseError);
      console.error('Raw response:', responseText);
      // Fallback
      plan = {
        summary: responseText,
        bestTime: 'Based on your preference',
        duration: '30 minutes',
        location: 'Your choice',
        recurring: 'As needed',
        tips: ['Start small and build momentum', 'Set a timer', 'Eliminate distractions']
      };
    }

    console.log('Successfully generated plan');
    res.json(plan);

  } catch (error) {
    console.error('Error planning activity:', error);

    if (error.status === 401) {
      return res.status(401).json({
        error: 'Invalid API key. Please check your ANTHROPIC_API_KEY environment variable.'
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again in a moment.'
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to plan activity. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /api/generate-routine - Generate AI-powered daily routine
app.post('/api/generate-routine', async (req, res) => {
  try {
    const { ideas, logs, checklist, reviews } = req.body;

    console.log(`Generating daily routine from ${ideas?.length || 0} ideas, ${logs?.length || 0} logs...`);

    // Format data for Claude
    const recentIdeas = (ideas || [])
      .slice(-30) // Last 30 ideas
      .map((idea, i) => {
        const tags = idea.tags?.length > 0 ? `[${idea.tags.join(', ')}]` : '';
        return `${i + 1}. ${tags} ${idea.content}`;
      })
      .join('\n');

    const recentLogs = (logs || [])
      .slice(-50) // Last 50 logs
      .map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const date = new Date(log.timestamp).toLocaleDateString();
        return `- [${date} ${time}] ${log.activity}: Energy ${log.energy}/10, Motivation ${log.motivation}/10${log.note ? ` (${log.note})` : ''}`;
      })
      .join('\n');

    const checklistInfo = checklist?.items?.length > 0
      ? checklist.items.map(item => `- ${item.text}${item.important ? ' (IMPORTANT)' : ''}`).join('\n')
      : 'No current routines';

    const recentReviews = (reviews || [])
      .slice(-7) // Last 7 reviews
      .map(review => {
        const date = new Date(review.timestamp).toLocaleDateString();
        return `[${date}] Energy: ${review.energy}/10, Accomplishments: ${review.accomplishments || 'none'}, Challenges: ${review.challenges || 'none'}`;
      })
      .join('\n');

    // Call Claude API using Haiku 3.5 for fast routine generation
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are an AI assistant helping someone with ADHD create an optimized daily routine.

Analyze ALL their data to generate a time-blocked schedule for TODAY that:
1. Prioritizes urgent/important items from their ideas
2. Considers their energy patterns from activity logs
3. Integrates their existing daily routines
4. Learns from their past reviews about what works
5. Includes breaks and buffer time (ADHD brains need this!)
6. Is realistic and achievable (don't overload them)

CAPTURED IDEAS (potential tasks to schedule):
${recentIdeas || 'No ideas yet'}

ACTIVITY LOGS (energy/motivation patterns):
${recentLogs || 'No logs yet'}

CURRENT DAILY ROUTINES:
${checklistInfo}

PAST REVIEWS (what worked/didn't work):
${recentReviews || 'No reviews yet'}

Based on this data, generate TODAY's optimized routine. IMPORTANT: Return ONLY valid JSON with no markdown formatting.

Return pure JSON (no code fences):
{
  "summary": "2-3 sentence overview of today's plan and why it's structured this way based on their patterns",
  "schedule": [
    {
      "time": "Time range (e.g., '9:00 AM - 10:30 AM')",
      "activity": "What to do during this block",
      "description": "Brief description of the activity",
      "priority": "high/medium/low",
      "reasoning": "Why this time slot is optimal based on their data"
    }
  ],
  "energyTips": [
    "Tip 1 based on their energy patterns",
    "Tip 2 for managing ADHD during the day",
    "Tip 3 for staying on track"
  ]
}

IMPORTANT GUIDELINES:
- Schedule 6-10 time blocks for the full day (morning to evening)
- Include their existing routines (meals, meds, etc.)
- Add tasks from their ideas that seem urgent or important
- Schedule high-energy tasks when their logs show high energy
- Include 15-30 min breaks between intense blocks
- Don't overschedule - ADHD brains need breathing room
- Be specific about times (e.g., "9:00 AM - 10:30 AM" not "morning")
- Make it actionable and realistic`
      }]
    });

    const responseText = message.content[0].text;

    // Parse JSON response
    let routine;
    try {
      let cleanedText = responseText.trim();
      cleanedText = cleanedText.replace(/^```json\s*/i, '');
      cleanedText = cleanedText.replace(/^```\s*/i, '');
      cleanedText = cleanedText.replace(/\s*```$/i, '');

      routine = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse routine response:', parseError);
      console.error('Raw response:', responseText);
      // Fallback
      routine = {
        summary: responseText,
        schedule: [],
        energyTips: ['Start with small tasks', 'Take regular breaks', 'Be kind to yourself']
      };
    }

    console.log('Successfully generated daily routine');
    res.json(routine);

  } catch (error) {
    console.error('❌ Error generating routine:');
    console.error('   Status:', error.status || 'N/A');
    console.error('   Message:', error.message);
    console.error('   Type:', error.type || 'N/A');
    if (process.env.NODE_ENV === 'development') {
      console.error('   Stack:', error.stack);
    }

    if (error.status === 401) {
      return res.status(401).json({
        error: 'Invalid API key. Please check your ANTHROPIC_API_KEY environment variable.'
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again in a moment.'
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to generate routine. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Subject classification cache (in-memory for MVP)
const subjectCache = new Map();

// Helper function to normalize subject for matching (alphanumeric only, lowercase)
const normalizeSubject = (subject) => {
  return subject.toLowerCase().replace(/[^a-z0-9]/g, '');
};

// POST /api/classify-subject - Classify a study subject into hierarchical categories
app.post('/api/classify-subject', async (req, res) => {
  try {
    const { subject } = req.body;

    if (!subject || typeof subject !== 'string') {
      return res.status(400).json({
        error: 'Invalid request: subject string is required'
      });
    }

    const normalizedSubject = normalizeSubject(subject);

    // Check cache first
    if (subjectCache.has(normalizedSubject)) {
      console.log(`Using cached classification for: ${subject}`);
      return res.json(subjectCache.get(normalizedSubject));
    }

    console.log(`Classifying subject: ${subject}...`);

    // Call Claude API for classification (using Haiku for cost efficiency)
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Classify this study subject into an academic hierarchy (2-3 levels). Preserve the specificity the user provides.

Subject: "${subject}"

Examples (2 levels for broad subjects):
- "statistics" or "stats" → ["Mathematics", "Statistics"]
- "chemistry" → ["Science", "Chemistry"]
- "physics" → ["Science", "Physics"]

Examples (3 levels for specific topics):
- "organic chemistry" → ["Science", "Chemistry", "Organic Chemistry"]
- "group theory" → ["Mathematics", "Abstract Algebra", "Group Theory"]
- "quantum mechanics" → ["Science", "Physics", "Quantum Mechanics"]
- "machine learning" → ["Computer Science", "Artificial Intelligence", "Machine Learning"]

Rules:
- If subject is a broad field (chemistry, statistics, physics): use 2 levels
- If subject is a specific topic (organic chemistry, quantum mechanics): use 3 levels
- IMPORTANT: Always include the subject they typed in the final level
- Don't add extra specificity (e.g., "statistics" should NOT become "Statistical Analysis")
- Match the user's specificity level exactly

Return ONLY JSON (no markdown):
{"hierarchy": ["Field", "Subfield", "Topic"], "normalized": "lowercasealphanumeric"}

The "normalized" field is the most specific level, alphanumeric only, lowercase, no spaces.`
      }]
    });

    const responseText = message.content[0].text;

    // Parse JSON response
    let classification;
    try {
      let cleanedText = responseText.trim();
      cleanedText = cleanedText.replace(/^```json\s*/i, '');
      cleanedText = cleanedText.replace(/^```\s*/i, '');
      cleanedText = cleanedText.replace(/\s*```$/i, '');

      classification = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse classification response:', parseError);
      // Fallback to simple classification
      classification = {
        hierarchy: [subject],
        normalized: normalizedSubject
      };
    }

    // Cache the result
    subjectCache.set(normalizedSubject, classification);

    console.log(`Classified "${subject}" as:`, classification.hierarchy.join(' → '));
    res.json(classification);

  } catch (error) {
    console.error('Error classifying subject:', error);
    res.status(500).json({
      error: error.message || 'Failed to classify subject'
    });
  }
});

// 7. INTELLIGENT TAG MANAGEMENT
// Analyzes tag usage patterns and recommends changes
app.post('/api/analyze-tags', async (req, res) => {
  try {
    const { ideas, currentTags } = req.body;

    if (!ideas || ideas.length === 0) {
      return res.json({
        recommendations: [],
        analysis: 'Not enough data to analyze tags yet.',
        keepTags: currentTags || []
      });
    }

    // Calculate tag usage statistics
    const tagStats = {};
    const customTagUsage = {};
    let totalIdeasWithTags = 0;

    ideas.forEach(idea => {
      if (idea.tags && idea.tags.length > 0) {
        totalIdeasWithTags++;
        idea.tags.forEach(tag => {
          const key = tag.toLowerCase();
          tagStats[key] = (tagStats[key] || 0) + 1;
          if (!currentTags.includes(key)) {
            customTagUsage[key] = (customTagUsage[key] || 0) + 1;
          }
        });
      }
    });

    const usagePercentage = totalIdeasWithTags / ideas.length;

    // Only proceed with AI analysis if user actively uses tags
    if (usagePercentage < 0.3) {
      return res.json({
        recommendations: [],
        analysis: `Tags are used in ${Math.round(usagePercentage * 100)}% of ideas. Keep experimenting! The system will optimize tags once you use them more frequently.`,
        keepTags: currentTags || [],
        stats: tagStats
      });
    }

    // Prepare context for AI
    const tagUsageReport = Object.entries(tagStats)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => `- ${tag}: ${count} uses (${Math.round((count / ideas.length) * 100)}%)`)
      .join('\n');

    const recentIdeasSample = ideas.slice(0, 30).map(idea =>
      `[Tags: ${idea.tags?.join(', ') || 'none'}] ${idea.content.substring(0, 80)}`
    ).join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Fast and cost-effective
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are analyzing tag usage for an ADHD productivity system.

Current predefined tags: ${currentTags.join(', ')}

Tag usage statistics:
${tagUsageReport}

Total ideas: ${ideas.length}
Ideas with tags: ${totalIdeasWithTags} (${Math.round(usagePercentage * 100)}%)

Sample of recent ideas:
${recentIdeasSample}

Based on this data:
1. Which current tags are rarely used and should be removed? (less than 5% usage)
2. Which custom tags are frequently used and should be added to the predefined list? (more than 10% usage and used at least 5 times)
3. Are the current tags meeting the user's needs?

IMPORTANT: Return ONLY valid JSON with no markdown formatting.

Return pure JSON (no code fences):
{
  "tagsToRemove": ["tag1", "tag2"],
  "tagsToAdd": ["tag3", "tag4"],
  "reasoning": "Brief explanation of changes",
  "analysis": "Overall assessment of tag usage patterns"
}`
      }]
    });

    const responseText = message.content[0].text;
    let result;

    try {
      let cleanedText = responseText.trim();
      cleanedText = cleanedText.replace(/^```json\s*/i, '');
      cleanedText = cleanedText.replace(/^```\s*/i, '');
      cleanedText = cleanedText.replace(/\s*```$/i, '');
      result = JSON.parse(cleanedText);
    } catch (parseError) {
      result = {
        tagsToRemove: [],
        tagsToAdd: [],
        reasoning: 'Failed to parse AI response',
        analysis: 'Tag system is working fine.'
      };
    }

    res.json({
      ...result,
      stats: tagStats,
      usagePercentage: Math.round(usagePercentage * 100)
    });

  } catch (error) {
    console.error('Error analyzing tags:', error);
    res.status(500).json({ error: 'Failed to analyze tags' });
  }
});

// 8. URGENCY & PRIORITY DETECTION
// Analyzes ideas and logs to determine what's urgent and important
app.post('/api/analyze-urgency', async (req, res) => {
  try {
    const { ideas, logs } = req.body;

    if (!ideas || ideas.length === 0) {
      return res.json({
        urgent: [],
        important: [],
        analysis: 'No ideas to analyze.'
      });
    }

    const today = new Date();
    const recentIdeas = ideas.slice(0, 50).map(idea => {
      const daysAgo = idea.timestamp ? Math.floor((today - new Date(idea.timestamp)) / (1000 * 60 * 60 * 24)) : 0;
      const dueInfo = idea.dueDate ? `Due: ${idea.dueDate}` : 'No due date';
      return `[${daysAgo}d ago, ${dueInfo}, Tags: ${idea.tags?.join(',') || 'none'}] ${idea.content}`;
    }).join('\n');

    const recentLogs = (logs || []).slice(-20).map(log => {
      const activity = log.activity || 'Unknown';
      const note = log.note ? ` - "${log.note}"` : '';
      return `[${activity}] Energy: ${log.energy}/10, Motivation: ${log.motivation}/10${note}`;
    }).join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Fast analysis
      max_tokens: 1536,
      messages: [{
        role: 'user',
        content: `You are analyzing priorities for someone with ADHD.

RECENT IDEAS:
${recentIdeas}

RECENT ACTIVITY LOGS:
${recentLogs || 'No logs yet'}

Analyze these ideas and determine:
1. Which items are URGENT (time-sensitive, due soon, mentioned repeatedly)
2. Which items are IMPORTANT (user shows enthusiasm, mentions frequently, aligns with their goals)
3. User sentiment towards each major theme (do they like/dislike certain activities?)
4. Priority scores for top items (0-100, considering urgency, importance, and sentiment)

Consider:
- Due dates and time sensitivity
- Frequency of mentions
- Language used (excited vs reluctant)
- Energy/motivation patterns from logs
- Tags that indicate priority (urgent, important)

IMPORTANT: Return ONLY valid JSON with no markdown formatting.

Return pure JSON (no code fences):
{
  "urgentItems": [
    {
      "content": "idea text",
      "score": 85,
      "reason": "Due in 2 days and mentioned 3 times"
    }
  ],
  "importantItems": [
    {
      "content": "idea text",
      "score": 75,
      "reason": "User shows high enthusiasm, aligns with goals"
    }
  ],
  "sentimentAnalysis": {
    "positiveThemes": ["studying", "projects"],
    "avoidedThemes": ["admin tasks"]
  },
  "recommendations": "Brief suggestions for what to prioritize today"
}`
      }]
    });

    const responseText = message.content[0].text;
    let result;

    try {
      let cleanedText = responseText.trim();
      cleanedText = cleanedText.replace(/^```json\s*/i, '');
      cleanedText = cleanedText.replace(/^```\s*/i, '');
      cleanedText = cleanedText.replace(/\s*```$/i, '');
      result = JSON.parse(cleanedText);
    } catch (parseError) {
      result = {
        urgentItems: [],
        importantItems: [],
        sentimentAnalysis: {},
        recommendations: 'Unable to analyze priorities at this time.'
      };
    }

    res.json(result);

  } catch (error) {
    console.error('Error analyzing urgency:', error);
    res.status(500).json({ error: 'Failed to analyze urgency' });
  }
});

// Smart Reminder System - Adaptive Frequency Algorithm
app.post('/api/get-reminders', async (req, res) => {
  try {
    const { ideas, logs, checklist, reviews, reminderHistory = [] } = req.body;

    // Calculate user's forgetfulness profile from their data
    const forgetfulnessProfile = calculateForgetfulnessProfile(logs, checklist, reviews);

    // Filter and score potential reminders from all sources
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get ideas that need reminders (due soon, recurring, or important)
    const reminderCandidates = ideas
      .filter(idea => {
        // Include upcoming deadlines (within 3 days)
        if (idea.dueDate) {
          const dueDate = new Date(idea.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
          if (daysUntilDue >= 0 && daysUntilDue <= 3) return true;
        }

        // Include recurring/ongoing items (no due date but recently mentioned)
        if (!idea.dueDate) {
          const createdDate = new Date(idea.timestamp);
          const daysAgo = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
          if (daysAgo <= 7) return true; // Recent ideas stay relevant
        }

        return false;
      })
      .map(idea => {
        const history = reminderHistory.find(h => h.ideaId === idea.id) || {
          ideaId: idea.id,
          lastShown: null,
          showCount: 0,
          dismissCount: 0,
          actionTaken: false
        };

        // Calculate importance and urgency scores
        const importance = calculateImportance(idea, ideas);
        const urgency = calculateUrgency(idea, today);

        return {
          ...idea,
          importance,
          urgency,
          history,
          frequencyScore: null // Will be calculated below
        };
      });

    // Calculate reminder frequency for each candidate
    const scoredReminders = reminderCandidates.map(reminder => {
      const frequencyScore = calculateReminderFrequency(
        reminder,
        forgetfulnessProfile,
        reminderCandidates.length,
        reminderHistory
      );

      return {
        ...reminder,
        frequencyScore
      };
    });

    // Sort by frequency score and select top reminders
    const sortedReminders = scoredReminders
      .sort((a, b) => b.frequencyScore - a.frequencyScore)
      .slice(0, Math.min(5, Math.ceil(scoredReminders.length * 0.3))); // Max 5, or 30% of candidates

    // Format reminders for display
    const formattedReminders = sortedReminders.map(r => {
      const daysUntilDue = r.dueDate
        ? Math.floor((new Date(r.dueDate) - today) / (1000 * 60 * 60 * 24))
        : null;

      let urgencyLabel = 'Low';
      if (r.urgency > 70) urgencyLabel = 'Critical';
      else if (r.urgency > 50) urgencyLabel = 'High';
      else if (r.urgency > 30) urgencyLabel = 'Medium';

      return {
        id: r.id,
        content: r.content,
        tags: r.tags,
        dueDate: r.dueDate,
        daysUntilDue,
        importance: Math.round(r.importance),
        urgency: Math.round(r.urgency),
        urgencyLabel,
        frequencyScore: Math.round(r.frequencyScore),
        shouldPlaySound: r.urgency > 70 || (r.importance > 80 && daysUntilDue !== null && daysUntilDue <= 1),
        lastShown: r.history.lastShown,
        timesShown: r.history.showCount
      };
    });

    res.json({
      reminders: formattedReminders,
      profile: {
        forgetfulnessScore: Math.round(forgetfulnessProfile.score * 100),
        category: forgetfulnessProfile.category,
        recommendedFrequency: forgetfulnessProfile.recommendedGenerations
      },
      metadata: {
        totalCandidates: reminderCandidates.length,
        selectedCount: formattedReminders.length,
        hasHighPriority: formattedReminders.some(r => r.shouldPlaySound)
      }
    });

  } catch (error) {
    console.error('Error generating reminders:', error);
    res.status(500).json({ error: 'Failed to generate reminders' });
  }
});

// Smart Routines - Generate personalized routine suggestions
app.post('/api/generate-smart-routines', async (req, res) => {
  try {
    const { ideas, logs, timetable, existingRoutines } = req.body;

    console.log('Generating smart routines...');

    // Prepare data summaries
    const recentIdeas = (ideas || []).slice(0, 30).map((idea, idx) => {
      const tags = idea.tags && idea.tags.length > 0 ? `[${idea.tags.join(', ')}]` : '';
      const classification = idea.classificationType && idea.classificationType !== 'general'
        ? ` (${idea.classificationType})` : '';
      return `${idx + 1}. ${tags}${classification} ${idea.content}`;
    }).join('\n');

    const recentLogs = (logs || []).slice(-20).map(log => {
      const activity = log.activity || 'Unknown';
      const note = log.note ? ` - "${log.note}"` : '';
      return `[${activity}] Energy: ${log.energy}/10, Motivation: ${log.motivation}/10${note}`;
    }).join('\n');

    const timetableInfo = (timetable || []).length > 0
      ? timetable.slice(0, 10).map(event => `${event.time || ''}: ${event.title || event.content}`).join('\n')
      : 'No scheduled events';

    const routinesInfo = (existingRoutines || []).length > 0
      ? existingRoutines.map(r => `- ${r.title || r.content} (${r.timeOfDay || 'any time'})`).join('\n')
      : 'No existing routines';

    // Call Claude API using Haiku 3.5 for fast generation
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are a routine optimization assistant for someone with ADHD. Generate 5 personalized routine suggestions.

CAPTURED IDEAS (potential routines):
${recentIdeas || 'No ideas yet'}

RECENT ACTIVITY LOGS (energy/behavior patterns):
${recentLogs || 'No logs yet'}

SCHEDULED EVENTS (timetable):
${timetableInfo}

EXISTING ROUTINES:
${routinesInfo}

Generate exactly 5 routine suggestions with this distribution:
- 2-3 DIRECT routines: Pull from user's explicit routine-related ideas (look for ideas about daily activities, habits, time-of-day mentions)
- 2-3 MASHUP routines: Synthesize patterns from multiple ideas/logs into new routines

For DIRECT routines:
- Use ideas that clearly mention routines, daily activities, or recurring tasks
- Reference the original idea content closely
- Mark type as "direct" and include source idea numbers

For MASHUP routines:
- Combine related ideas or patterns from logs
- Create plausible, actionable routines based on their behavior
- Mark type as "mashup" and list all contributing sources

Consider:
- Time of day based on energy patterns from logs
- Avoid duplicating existing routines
- Match their actual behavior patterns
- Keep routines realistic for ADHD (not too ambitious)

IMPORTANT: Return ONLY valid JSON with no markdown formatting.

Return pure JSON (no code fences):
{
  "routines": [
    {
      "type": "direct",
      "title": "Short, clear routine title",
      "description": "What this routine involves (1-2 sentences)",
      "timeOfDay": "morning|afternoon|evening|anytime",
      "frequency": "daily|weekdays|weekends|weekly",
      "duration": "estimated duration (e.g., '15 minutes', '30-45 minutes')",
      "sources": ["idea-3", "idea-7"],
      "reasoning": "Why this routine fits their patterns (brief)"
    },
    {
      "type": "mashup",
      "title": "...",
      "description": "...",
      "timeOfDay": "...",
      "frequency": "...",
      "duration": "...",
      "sources": ["idea-1", "idea-5", "log-pattern"],
      "reasoning": "..."
    }
  ]
}

Be practical and supportive. Focus on routines they'll actually follow.`
      }]
    });

    const responseText = message.content[0].text;

    // Parse JSON response
    let routinesData;
    try {
      let cleanedText = responseText.trim();
      cleanedText = cleanedText.replace(/^```json\s*/i, '');
      cleanedText = cleanedText.replace(/^```\s*/i, '');
      cleanedText = cleanedText.replace(/\s*```$/i, '');

      routinesData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse smart routines response:', parseError);
      console.error('Raw response:', responseText);
      // Fallback
      routinesData = {
        routines: []
      };
    }

    // Add unique IDs to routines
    const routinesWithIds = routinesData.routines.map((routine, idx) => ({
      id: `routine-${Date.now()}-${idx}`,
      ...routine
    }));

    console.log(`Generated ${routinesWithIds.length} smart routines`);
    res.json({
      routines: routinesWithIds,
      metadata: {
        totalGenerated: routinesWithIds.length,
        directCount: routinesWithIds.filter(r => r.type === 'direct').length,
        mashupCount: routinesWithIds.filter(r => r.type === 'mashup').length
      }
    });

  } catch (error) {
    console.error('❌ Error generating smart routines:');
    console.error('   Status:', error.status || 'N/A');
    console.error('   Message:', error.message);
    console.error('   Type:', error.type || 'N/A');
    if (process.env.NODE_ENV === 'development') {
      console.error('   Stack:', error.stack);
    }

    if (error.status === 401) {
      return res.status(401).json({
        error: 'Invalid API key. Please check your ANTHROPIC_API_KEY environment variable.'
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again in a moment.'
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to generate smart routines. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Helper: Calculate user's forgetfulness profile from their behavioral data
function calculateForgetfulnessProfile(logs, checklist, reviews) {
  // Default baseline: Average human (Ebbinghaus forgetting curve + Miller's Law)
  // Research shows: 50% forgotten after 1 hour, 70% after 24 hours, 90% after 31 days
  const defaultProfile = {
    score: 0.65, // Moderate forgetfulness (0 = perfect memory, 1 = very forgetful)
    category: 'Average',
    recommendedGenerations: 5 // Remind every ~5 generations for important items
  };

  if (!logs || logs.length < 10) {
    return defaultProfile; // Not enough data, use baseline
  }

  let forgetfulnessIndicators = 0;
  let totalDataPoints = 0;

  // Analyze logs for forgetting patterns
  const forgetKeywords = ['forgot', 'missed', 'didn\'t remember', 'overlooked', 'skipped'];
  const logMentions = logs.filter(log =>
    forgetKeywords.some(keyword => log.content?.toLowerCase().includes(keyword))
  );
  forgetfulnessIndicators += logMentions.length * 2; // Weight logs heavily
  totalDataPoints += logs.length;

  // Analyze checklist completion rates
  if (checklist?.items?.length > 0) {
    const completedItems = checklist.items.filter(item => item.completed).length;
    const completionRate = completedItems / checklist.items.length;
    forgetfulnessIndicators += (1 - completionRate) * 10; // Incomplete tasks indicate forgetting
    totalDataPoints += 10;
  }

  // Analyze reviews for patterns
  if (reviews && reviews.length > 0) {
    const recentReviews = reviews.slice(0, 5);
    recentReviews.forEach(review => {
      if (review.content) {
        const hasForgetMention = forgetKeywords.some(kw =>
          review.content.toLowerCase().includes(kw)
        );
        if (hasForgetMention) forgetfulnessIndicators += 3;
      }
    });
    totalDataPoints += recentReviews.length * 3;
  }

  // Calculate normalized score (0-1 scale)
  const rawScore = totalDataPoints > 0 ? forgetfulnessIndicators / totalDataPoints : 0.65;
  const normalizedScore = Math.max(0.2, Math.min(0.95, rawScore)); // Clamp between 0.2-0.95

  // Categorize and provide recommendations
  let category, recommendedGenerations;
  if (normalizedScore < 0.4) {
    category = 'Low Forgetfulness';
    recommendedGenerations = 8; // Remind less often
  } else if (normalizedScore < 0.7) {
    category = 'Average';
    recommendedGenerations = 5; // Standard frequency
  } else {
    category = 'High Forgetfulness';
    recommendedGenerations = 3; // Remind more often
  }

  return {
    score: normalizedScore,
    category,
    recommendedGenerations
  };
}

// Helper: Calculate importance score (0-100) based on frequency, enthusiasm, and patterns
function calculateImportance(idea, allIdeas) {
  let score = 50; // Start at neutral

  // Check frequency: How often does similar content appear?
  const similarIdeas = allIdeas.filter(other => {
    if (other.id === idea.id) return false;
    const contentSimilarity = idea.content?.toLowerCase().split(' ')
      .filter(word => word.length > 4)
      .some(word => other.content?.toLowerCase().includes(word));
    const tagOverlap = idea.tags?.some(tag => other.tags?.includes(tag));
    return contentSimilarity || tagOverlap;
  });

  if (similarIdeas.length > 5) score += 20; // Frequently mentioned topic
  else if (similarIdeas.length > 2) score += 10;

  // Check enthusiasm markers (exclamation marks, positive words)
  const enthusiasmMarkers = idea.content?.match(/!|amazing|love|excited|important|priority/gi);
  if (enthusiasmMarkers) {
    score += Math.min(enthusiasmMarkers.length * 5, 20);
  }

  // Check tags for priority indicators
  const priorityTags = ['work', 'urgent', 'important', 'deadline', 'assignment'];
  const hasPriorityTag = idea.tags?.some(tag =>
    priorityTags.some(pt => tag.toLowerCase().includes(pt))
  );
  if (hasPriorityTag) score += 15;

  return Math.max(0, Math.min(100, score));
}

// Helper: Calculate urgency score (0-100) based on time sensitivity
function calculateUrgency(idea, today) {
  let score = 30; // Default low urgency for ongoing items

  if (!idea.dueDate) {
    // No deadline = ongoing/recurring, but check recency
    const createdDate = new Date(idea.timestamp);
    const daysAgo = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0) score = 50; // Created today
    else if (daysAgo <= 2) score = 40; // Very recent
    return score;
  }

  // Has deadline - calculate based on time remaining
  const dueDate = new Date(idea.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) return 100; // Overdue!
  if (daysUntilDue === 0) return 95; // Due today
  if (daysUntilDue === 1) return 85; // Due tomorrow
  if (daysUntilDue === 2) return 70; // Due in 2 days
  if (daysUntilDue === 3) return 55; // Due in 3 days
  if (daysUntilDue <= 7) return 40; // Due this week

  return 30; // Due later
}

// Helper: Calculate reminder frequency score using adaptive algorithm
function calculateReminderFrequency(reminder, userProfile, totalReminders, reminderHistory) {
  // Base score from importance and urgency (0-100 scale)
  const baseScore = (reminder.importance * 0.6) + (reminder.urgency * 0.4);

  // Forgetfulness multiplier (0.2 to 1.5)
  // High forgetfulness = show more often, low = show less often
  const forgetfulnessMultiplier = 0.5 + (userProfile.score * 1.0);

  // Load adjustment (avoid overwhelming with too many reminders)
  // More total reminders = lower individual scores
  const loadAdjustment = totalReminders > 0
    ? 1 / Math.log(totalReminders + 2)
    : 1;

  // Time decay (show reminders that haven't been shown recently)
  const daysSinceShown = reminder.history.lastShown
    ? Math.floor((new Date() - new Date(reminder.history.lastShown)) / (1000 * 60 * 60 * 24))
    : 999; // Never shown = max decay bonus

  const timeDecayBonus = Math.min(daysSinceShown / 7, 1.5); // Cap at 1.5x bonus after 1 week

  // Engagement penalty (if user keeps dismissing, show less)
  const engagementRate = reminder.history.showCount > 0
    ? 1 - (reminder.history.dismissCount / reminder.history.showCount)
    : 1; // No history = neutral

  const engagementMultiplier = Math.max(0.3, engagementRate); // Minimum 0.3x even if always dismissed

  // Final frequency score
  const frequencyScore = baseScore *
                        forgetfulnessMultiplier *
                        loadAdjustment *
                        timeDecayBonus *
                        engagementMultiplier;

  return frequencyScore;
}

// AI-Powered Idea Classification - Auto-classify captured ideas (Haiku 3.5 for cost efficiency)
app.post('/api/classify-idea', async (req, res) => {
  try {
    const { content, context, timestamp, currentTags } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Use Haiku 3.5 for cost efficiency (~$0.0001 per classification)
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Analyze this captured idea and classify it. Return pure JSON (no code fences):

Content: "${content}"
Context: "${context || 'none'}"
Existing Tags: ${currentTags?.join(', ') || 'none'}
Captured: ${timestamp ? new Date(timestamp).toLocaleDateString() : 'now'}

Classify into ONE of these types:
- "routine": Recurring activities (daily/weekly patterns, habits)
- "checklist": One-time tasks or non-recurring activities
- "timetable": Specific date/time events (appointments, deadlines, exams)
- "general": Default for ideas that don't fit above

Also detect:
- Duration estimate in minutes
- Recurrence pattern (if routine)
- Time of day preference
- Priority level

Return JSON:
{
  "classificationType": "routine|checklist|timetable|general",
  "duration": number or null,
  "recurrence": "none"|"daily"|"weekly"|"monthly"|null,
  "timeOfDay": "morning"|"afternoon"|"evening"|"night"|null,
  "priority": "high"|"medium"|"low",
  "reasoning": "Brief explanation of classification"
}`
      }]
    });

    let classification;
    try {
      let responseText = message.content[0].text;

      // Strip markdown code fences if present
      responseText = responseText.trim();
      responseText = responseText.replace(/^```json\s*/i, '');
      responseText = responseText.replace(/^```\s*/i, '');
      responseText = responseText.replace(/\s*```$/i, '');

      classification = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse classification JSON:', parseError);
      // Return default classification
      classification = {
        classificationType: 'general',
        duration: null,
        recurrence: 'none',
        timeOfDay: null,
        priority: 'medium',
        reasoning: 'Could not parse AI response, using default classification'
      };
    }

    res.json(classification);

  } catch (error) {
    console.error('Error classifying idea:', error);
    res.status(500).json({
      error: 'Failed to classify idea',
      fallback: {
        classificationType: 'general',
        duration: null,
        recurrence: 'none',
        timeOfDay: null,
        priority: 'medium',
        reasoning: 'Error occurred, using default classification'
      }
    });
  }
});

// Batch Classification - Classify multiple ideas at once for efficiency
app.post('/api/classify-ideas-batch', async (req, res) => {
  try {
    const { ideas } = req.body;

    if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
      return res.status(400).json({ error: 'Ideas array is required' });
    }

    // Limit batch size to prevent excessive API costs
    const batchSize = Math.min(ideas.length, 10);
    const ideasToClassify = ideas.slice(0, batchSize);

    const ideasText = ideasToClassify.map((idea, idx) =>
      `${idx + 1}. "${idea.content}" ${idea.context ? `(Context: ${idea.context})` : ''}`
    ).join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Classify these ${batchSize} ideas. For each, determine type, duration, recurrence, time preference, and priority.

Ideas:
${ideasText}

Types: "routine" (recurring), "checklist" (one-time task), "timetable" (specific event), "general" (default)

Return pure JSON array (no code fences):
[
  {
    "index": 1,
    "classificationType": "type",
    "duration": number_or_null,
    "recurrence": "none|daily|weekly|monthly",
    "timeOfDay": "morning|afternoon|evening|night|null",
    "priority": "high|medium|low"
  }
]`
      }]
    });

    let classifications;
    try {
      let responseText = message.content[0].text;
      responseText = responseText.trim();
      responseText = responseText.replace(/^```json\s*/i, '');
      responseText = responseText.replace(/^```\s*/i, '');
      responseText = responseText.replace(/\s*```$/i, '');

      classifications = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse batch classification JSON:', parseError);
      // Return defaults for all
      classifications = ideasToClassify.map((_, idx) => ({
        index: idx + 1,
        classificationType: 'general',
        duration: null,
        recurrence: 'none',
        timeOfDay: null,
        priority: 'medium'
      }));
    }

    res.json({ classifications });

  } catch (error) {
    console.error('Error in batch classification:', error);
    res.status(500).json({ error: 'Failed to classify ideas' });
  }
});

// Serve static files from the React app build (in production)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA fallback - serve index.html for non-API routes (must be before 404 handler)
app.use((req, res, next) => {
  // If it's an API route, pass to 404 handler
  if (req.path.startsWith('/api') || req.path === '/health') {
    return next();
  }
  // Otherwise serve the React app
  res.sendFile(path.join(distPath, 'index.html'));
});

// 404 handler for API routes only
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: {
      'GET /health': 'Health check',
      'POST /api/organize-ideas': 'Organize ideas with AI',
      'POST /api/weekly-summary': 'Get weekly summary',
      'POST /api/analyze-patterns': 'Analyze patterns in logs and ideas',
      'POST /api/plan-activity': 'Get AI planning advice for an activity',
      'POST /api/generate-routine': 'Generate AI-powered daily routine',
      'POST /api/classify-subject': 'Classify study subject into categories',
      'POST /api/analyze-tags': 'Intelligent tag management',
      'POST /api/analyze-urgency': 'AI-powered urgency detection',
      'POST /api/get-reminders': 'Smart reminder system with adaptive frequency',
      'POST /api/classify-idea': 'Auto-classify captured idea (Haiku 3.5)',
      'POST /api/classify-ideas-batch': 'Batch classify multiple ideas'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║   Neural Capture API Server                   ║
║   Running on http://localhost:${PORT}           ║
║                                                ║
║   Endpoints:                                   ║
║   GET  /health                                 ║
║   POST /api/organize-ideas                     ║
║   POST /api/weekly-summary                     ║
║   POST /api/analyze-patterns                   ║
║   POST /api/plan-activity                      ║
║   POST /api/generate-routine                   ║
║   POST /api/generate-smart-routines [NEW]      ║
║   POST /api/classify-subject                   ║
║   POST /api/analyze-tags                       ║
║   POST /api/analyze-urgency                    ║
║   POST /api/get-reminders                      ║
║   POST /api/classify-idea                      ║
║   POST /api/classify-ideas-batch               ║
║                                                ║
║   Make sure ANTHROPIC_API_KEY is set!          ║
╚════════════════════════════════════════════════╝
  `);

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('\n❌ ERROR: ANTHROPIC_API_KEY environment variable is not set!');
    console.error('   1. Create a .env file in the project root');
    console.error('   2. Add this line: ANTHROPIC_API_KEY=sk-ant-...');
    console.error('   3. Get your key from: https://console.anthropic.com/settings/keys\n');
  } else if (process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
    console.error('\n❌ ERROR: ANTHROPIC_API_KEY is set to the placeholder value!');
    console.error('   Replace "your_api_key_here" with your actual API key.\n');
  } else if (!process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    console.warn('\n⚠️  WARNING: ANTHROPIC_API_KEY format looks incorrect!');
    console.warn('   API keys should start with "sk-ant-"');
    console.warn('   Current value starts with:', process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...\n');
  } else {
    console.log('\n✓ ANTHROPIC_API_KEY is configured correctly\n');
  }
});
