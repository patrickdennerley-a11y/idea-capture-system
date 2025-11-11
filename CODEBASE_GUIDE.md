# Neural Capture Codebase Guide

**Quick navigation guide for finding and fixing code in the Neural Capture ADHD life management app.**

---

## 📁 Project Structure Overview

```
idea-capture-system/
├── src/
│   ├── components/          # React components (UI)
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Helper functions & API calls
│   ├── App.jsx              # Main app shell & tab navigation
│   ├── index.css            # Global styles & Tailwind
│   └── main.jsx             # React entry point
├── server.cjs               # Express backend (Claude API)
└── package.json             # Dependencies
```

---

## 🎯 Quick Fix Reference

### UI/Display Issues

| Issue Type | File to Edit | Lines |
|------------|--------------|-------|
| Slider alignment/appearance | `src/index.css` | 90-138 (slider CSS) |
| Slider gradient calculation | Component with slider | Look for `((value - 1) / 9) * 100` |
| Calendar display | `src/components/QuickLogger.jsx` | 666-757 (unified calendar) |
| Stat boxes squished | Component file | Search for `p-4` or `p-5` padding |
| Bullet point alignment | Any component | Remove `mt-1` from bullet spans |

### Feature Bugs

| Bug Type | File to Edit | Key Function/Section |
|----------|--------------|---------------------|
| Duration parsing issues | `src/components/QuickLogger.jsx` | `logEntry()` function (lines 80-139) |
| Study time calculation | `src/components/QuickLogger.jsx` | Search for `studyTime` calculation |
| Subject classification | `server.cjs` | `/api/classify-subject` endpoint (lines 430-518) |
| Drag-and-drop reordering | `src/components/IdeaCapture.jsx` | `handleDragStart/Over/Drop` (lines 225-309) |
| Ideas not saving | `src/components/IdeaCapture.jsx` | `saveIdea()` function |

### Backend/API Issues

| Issue Type | File to Edit | Endpoint |
|------------|--------------|----------|
| AI organization not working | `server.cjs` | `/api/organize-ideas` (lines 36-166) |
| Planning assistant errors | `server.cjs` | `/api/plan-activity` (lines 293-420) |
| Classification cache | `server.cjs` | `subjectCache` Map (line 423) |
| Model name errors | `server.cjs` | Search for `model:` in API calls |

---

## 📂 Component Files Deep Dive

### `src/App.jsx` - Main Navigation Shell
**Purpose:** Tab navigation and app-level state management

**Key sections:**
- Lines 22-29: `TABS` array - Add/modify tabs here
- Lines 44-75: `renderActiveTab()` - Component routing logic
- Lines 77-150: Header, mobile menu, navigation UI

**When to edit:**
- Adding new tabs/features
- Changing navigation layout
- Modifying mobile menu behavior

---

### `src/components/IdeaCapture.jsx` - Idea Capture & Organization
**Purpose:** Capture ideas with tags, voice input, AI organization, drag-and-drop reordering

**Key sections:**
- Lines 1-46: State management (includes drag-and-drop state)
- Lines 97-123: `saveIdea()` - Saving captured ideas
- Lines 150-152: `deleteIdea()` - Deleting ideas
- Lines 175-205: `handleOrganizeIdeas()` - AI organization trigger
- Lines 225-309: Drag-and-drop handlers with accelerated scrolling
- Lines 462-515: Ideas list rendering (draggable cards)
- Lines 557-677: AI organized results modal
- Lines 679-774: Organization history modal

**When to edit:**
- Idea capture form changes
- Drag-and-drop behavior
- AI organization UI
- Tag management
- Voice input issues

**Important notes:**
- Auto-saves drafts after 3 seconds (line 126)
- Ideas stored newest-first
- Filtered ideas exclude drafts (line 320)
- Drag-and-drop uses `scrollContainerRef` for auto-scroll

---

### `src/components/QuickLogger.jsx` - Activity Logger & History
**Purpose:** Log activities, energy, motivation, study time with timer, AI subject classification

**Key sections:**
- Lines 1-59: State management (mode, timer, duration, energy, motivation)
- Lines 61-78: Timer functions (start, pause, reset)
- Lines 80-139: `logEntry()` - **CRITICAL** - Captures values before async operations to prevent race conditions
- Lines 141-145: `deleteLog()` - Delete log entries
- Lines 147-172: Stats calculation (study time, avg energy/motivation)
- Lines 174-194: `classifySubject()` - AI subject classification (cached)
- Lines 196-228: History data preparation
- Lines 230-665: UI rendering (Today's Pulse, logging form, activity grid)
- Lines 666-757: **Unified 30-day calendar** with energy, motivation, study time bars
- Lines 759-857: Day details view with 4 stat cards

**When to edit:**
- Duration input bugs → Check `logEntry()` line 80-139
- Study time display → Search for `studyTime` calculation
- Calendar appearance → Lines 666-757
- Stat boxes squished → Padding in Today's Pulse section
- Subject classification → Lines 174-194 or `server.cjs`

**Important notes:**
- Duration input: Captures value in local const before await to prevent race conditions (line 84)
- Timer mode vs Manual mode toggle (line 246)
- Subject classification caching (line 189)
- Study time rounded to 1 decimal place (line 161)

---

### `src/components/PlanningAssistant.jsx` - Pre-Action Planning
**Purpose:** AI-powered planning recommendations using Sonnet 4.5

**Key sections:**
- Lines 1-44: State management and planning logic
- Lines 11-37: `handlePlan()` - Calls API with user data
- Lines 46-97: Input form and "Plan It" button
- Lines 106-205: Plan display (summary, bestTime, duration, location, recurring, tips)
- Lines 208-238: Help text explaining how it works

**When to edit:**
- Planning form UI
- Recommendation display cards
- Help text
- Error handling

**Important notes:**
- Uses Sonnet 4.5 for quality (not Haiku)
- Passes ideas, logs, checklist, reviews for context
- Bullet points have NO `mt-1` for proper alignment

---

### `src/components/DailyChecklist.jsx` - Daily Routines
**Purpose:** Manage daily recurring tasks

**Key sections:**
- Routine management
- Checkbox states
- Daily reset logic

**When to edit:**
- Checklist UI changes
- Routine saving/loading
- Daily reset behavior

---

### `src/components/EndOfDayReview.jsx` - Daily Review
**Purpose:** End-of-day reflection and review

**Key sections:**
- Lines 1-30: State management
- Lines 32-76: Review saving logic
- Lines 78-200: Review form UI
- Lines 202-350: Past reviews display
- Lines 278-280: **Slider gradient fix** - Uses `((value - 1) / 9) * 100`

**When to edit:**
- Slider alignment → Lines 278-280
- Review form fields
- Past reviews display

**Important notes:**
- Slider uses same gradient calculation as QuickLogger
- Energy recall saved with timestamp

---

### `src/components/NoiseHub.jsx` - Ambient Noise Player
**Purpose:** Background noise for focus (brown/white noise, rain, etc.)

**Key sections:**
- Audio player logic
- Noise type selection
- Volume controls

**When to edit:**
- Adding new noise types
- Audio playback issues
- UI changes

---

## 🔧 Utility Files

### `src/utils/apiService.js` - Backend API Calls
**Purpose:** All fetch calls to backend with retry logic

**Functions:**
- `organizeIdeas()` - POST /api/organize-ideas
- `classifySubject()` - POST /api/classify-subject (lines 118-141)
- `getPlanningAdvice()` - POST /api/plan-activity (lines 143-170)
- `checkBackendHealth()` - GET /health

**When to edit:**
- Adding new API endpoints
- Changing retry logic
- Modifying request/response handling

**Important notes:**
- All requests use `fetchWithRetry` for reliability
- API_BASE_URL switches based on dev/prod environment

---

### `src/utils/dateUtils.js` - Date Formatting
**Purpose:** Consistent date/time formatting

**Functions:**
- `formatDateTime()` - Human-readable timestamps
- `getTodayString()` - YYYY-MM-DD format
- `getDateString()` - Convert date to string

**When to edit:**
- Changing date display format
- Adding new date utilities

---

### `src/hooks/useLocalStorage.js` - Persistent State
**Purpose:** localStorage wrapper for React state

**When to edit:**
- Storage key changes
- Adding serialization logic

---

## ⚙️ Backend - `server.cjs`

**Purpose:** Express server handling all Claude API calls

### Key Endpoints:

#### `POST /api/organize-ideas` (lines 36-166)
- **Model:** Sonnet 4.5
- **Purpose:** Organize captured ideas by theme, priority, next steps
- **Returns:** JSON with themes, summary, nextSteps

#### `POST /api/weekly-summary` (lines 168-221)
- **Model:** Sonnet 4.5
- **Purpose:** Weekly summary of captured ideas
- **Returns:** Summary text with patterns and suggestions

#### `POST /api/analyze-patterns` (lines 223-291)
- **Model:** Sonnet 4.5
- **Purpose:** Correlate energy logs with ideas
- **Returns:** Analysis of best times, patterns, recommendations

#### `POST /api/plan-activity` (lines 293-420)
- **Model:** Sonnet 4.5 (quality over cost)
- **Purpose:** Pre-action planning assistant
- **Returns:** summary, bestTime, duration, location, recurring, tips
- **Context:** Uses last 20 ideas, logs, checklist items, latest review

#### `POST /api/classify-subject` (lines 430-518)
- **Model:** Haiku 3.5 (cost-optimized)
- **Purpose:** Classify study subjects into hierarchy
- **Returns:** hierarchy array (2-3 levels), normalized string
- **Cache:** In-memory Map with normalized alphanumeric keys (line 423)
- **Prompt Balance:** 2 levels for broad subjects, 3 for specific topics

### When to edit backend:
- Prompt engineering → Find the endpoint, update `content:` in messages
- Model changes → Change `model:` parameter (Haiku vs Sonnet)
- Cache behavior → Modify `subjectCache` Map logic
- New endpoints → Add before 404 handler (line 520)

### Model Names (CRITICAL):
```javascript
// ✅ CORRECT:
'claude-sonnet-4-5-20250929'  // Sonnet 4.5 (quality)
'claude-3-5-haiku-20241022'   // Haiku 3.5 (cost-efficient)

// ❌ WRONG:
'claude-haiku-3-5-20241022'   // Old format, causes 404
```

---

## 🎨 Styling - `src/index.css`

### Key Sections:

#### Custom Classes (lines 1-88)
- `.neural-card` - Main card container
- `.neural-button` - Primary buttons
- `.neural-button-secondary` - Secondary buttons
- `.neural-input` - Text inputs
- `.neural-textarea` - Textareas
- `.pulse-glow` - Pulsing purple glow effect

#### Slider Styling (lines 90-138)
- **WebKit thumb** (lines 90-99)
- **Firefox thumb** (lines 101-110)
- **Focus states** (lines 112-129)
- **Track styles** (lines 131-138)

**When to edit sliders:**
- Alignment issues → Check `background` linear-gradient calculation in component
- Appearance changes → Lines 90-138 in index.css
- Always use `slider` class on input

#### Animations (lines 140-160)
- `@keyframes slide-in` - Slide from left with fade
- `.animate-slide-in` - Apply slide animation

---

## 🐛 Common Bug Patterns

### 1. Duration Input Showing Wrong Value
**File:** `src/components/QuickLogger.jsx`
**Cause:** Async race condition in `logEntry()`
**Fix:** Capture form values in local consts BEFORE any await
```javascript
const logEntry = async () => {
  // ✅ Capture values first
  const currentDuration = duration;
  const currentSubject = subject;

  // Then do async operations
  await classifySubject(currentSubject);

  // Use captured values in log object
  setLogs([...logs, { duration: currentDuration }]);
};
```

### 2. Slider Line Extends Past Thumb
**Files:** `src/components/QuickLogger.jsx`, `src/components/EndOfDayReview.jsx`
**Cause:** Incorrect gradient percentage calculation for 1-10 range
**Fix:** Use `((value - 1) / 9) * 100` for proper scaling
```javascript
style={{
  background: `linear-gradient(to right,
    #a855f7 0%,
    #a855f7 ${((value - 1) / 9) * 100}%,
    #1a1a1f ${((value - 1) / 9) * 100}%,
    #1a1a1f 100%)`
}}
```

### 3. Classification Too Verbose/Not Verbose Enough
**File:** `server.cjs`
**Location:** `/api/classify-subject` endpoint, prompt (lines 327-354)
**Fix:** Adjust examples and rules in prompt
- Broad subjects (chemistry, stats) → 2 levels
- Specific topics (organic chemistry, quantum mechanics) → 3 levels
- Always include user's typed subject in final level

### 4. Backend 404 Errors
**Causes:**
- Wrong model name (use correct format above)
- Server not restarted after adding endpoint
- ANTHROPIC_API_KEY not set in .env

**Fix:**
- Check model name format
- Restart: `pkill -f "node.*server.cjs" && npm run server`
- Add API key to .env file

### 5. Squished UI Elements
**Common locations:**
- Today's Pulse stat boxes
- Calendar day cells
- Card containers

**Fix:**
- Increase padding: `p-4` → `p-5`
- Adjust responsive breakpoints: `sm:grid-cols-2 lg:grid-cols-3`
- Add spacing: `gap-3`, `mb-3`, `space-y-3`

### 6. Bullet Points Misaligned
**Cause:** Extra margin on bullet span pushes it down
**Fix:** Remove `mt-1` from bullet span
```jsx
// ❌ Wrong:
<span className="text-neural-purple mt-1">•</span>

// ✅ Correct:
<span className="text-neural-purple">•</span>
```

---

## 🔍 Finding Specific Functionality

### Search Patterns:

| Looking for... | Search for... | File |
|----------------|---------------|------|
| Timer logic | `timerInterval`, `startTimer` | QuickLogger.jsx |
| Duration parsing | `parseInt(duration` | QuickLogger.jsx |
| Subject classification | `classifySubject` | QuickLogger.jsx, apiService.js, server.cjs |
| Study time calculation | `filter(log => log.activity === 'Studying')` | QuickLogger.jsx |
| Drag-and-drop | `handleDragStart`, `draggable` | IdeaCapture.jsx |
| Calendar rendering | `days.map`, `30-Day Overview` | QuickLogger.jsx |
| Slider gradients | `linear-gradient`, `((value - 1) / 9)` | QuickLogger.jsx, EndOfDayReview.jsx |
| AI prompts | `content:` in `messages:` array | server.cjs |
| localStorage keys | `neural-` | Look for useLocalStorage calls |

---

## 🚀 Testing After Changes

### Frontend Changes:
1. Check browser console for errors
2. Test responsive layouts (mobile, tablet, desktop)
3. Verify localStorage persistence (refresh page)
4. Check all tabs load correctly

### Backend Changes:
1. Restart server: `pkill -f "node.*server.cjs" && npm run server`
2. Check server console logs
3. Verify API responses in Network tab
4. Test error handling (disconnect server)

### Slider/Range Input Changes:
1. Test all values (1-10)
2. Check visual alignment at extremes (1 and 10)
3. Verify gradient matches thumb position
4. Test in different browsers (Chrome, Firefox)

### Performance Testing (for large datasets):
- Add 100+ ideas → Test drag-and-drop smoothness
- Add 100+ logs → Test calendar rendering speed
- Check scroll performance with accelerated dragging

---

## 📦 Dependencies & Technologies

### Frontend:
- **React 18.3.1** - UI framework
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Utility-first CSS
- **lucide-react** - Icon library

### Backend:
- **Express** - Node.js server framework
- **@anthropic-ai/sdk** - Claude API client
- **cors** - Cross-origin requests
- **dotenv** - Environment variables

### Key Tailwind Custom Colors:
```javascript
// tailwind.config.js
neural-purple: '#a855f7'
neural-pink: '#ec4899'
neural-blue: '#3b82f6'
neural-dark: '#0a0a0f'
neural-darker: '#1a1a1f'
```

---

## 🎯 Feature Implementation Checklist

When adding a new feature:

1. **Component** (if needed)
   - [ ] Create in `src/components/`
   - [ ] Add header comment with purpose
   - [ ] Export default

2. **Navigation** (if new tab)
   - [ ] Add to TABS array in `App.jsx`
   - [ ] Add icon import from lucide-react
   - [ ] Add case in renderActiveTab()

3. **Backend Endpoint** (if AI-powered)
   - [ ] Add POST route in `server.cjs`
   - [ ] Choose model (Haiku = cheap, Sonnet = quality)
   - [ ] Write prompt with clear instructions
   - [ ] Handle JSON parsing with fallback
   - [ ] Add to 404 handler endpoint list
   - [ ] Add to startup banner

4. **API Service** (if backend call)
   - [ ] Add function in `src/utils/apiService.js`
   - [ ] Use `fetchWithRetry` wrapper
   - [ ] Return `{ success, data/error }` format

5. **Testing**
   - [ ] Restart backend server
   - [ ] Test happy path
   - [ ] Test error handling
   - [ ] Test with empty data
   - [ ] Test mobile layout

6. **Commit**
   - [ ] Descriptive commit message
   - [ ] Push to feature branch
   - [ ] Test on fresh pull

---

## 🔐 Environment Setup

Required `.env` file:
```bash
ANTHROPIC_API_KEY=your-api-key-here
PORT=3001  # Optional, defaults to 3001
NODE_ENV=development  # Optional
```

---

## 📝 Code Style Notes

- **Components:** PascalCase (e.g., `QuickLogger.jsx`)
- **Functions:** camelCase (e.g., `saveIdea()`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `IDEA_TAGS`)
- **CSS Classes:** kebab-case (e.g., `neural-button`)
- **localStorage Keys:** kebab-case with prefix (e.g., `neural-ideas`)

**Naming Conventions:**
- `handle*` - Event handlers (handleClick, handleDragStart)
- `set*` - State setters from useState
- `is*` - Boolean state (isLoading, isOrganizing)
- `show*` - Boolean for visibility (showModal, showHistory)

---

## 🎓 Learning Path

If you're new to this codebase, read in this order:

1. **This guide** - Overall architecture
2. **App.jsx** - Navigation structure
3. **IdeaCapture.jsx** - Understand idea flow
4. **QuickLogger.jsx** - Most complex component (timer, classification, history)
5. **server.cjs** - Backend API structure
6. **apiService.js** - Frontend-backend communication

---

## 🆘 Quick Troubleshooting

### "Cannot read property of undefined"
- Check component props are passed correctly
- Verify localStorage has data (may be null on first load)
- Add optional chaining: `ideas?.length` instead of `ideas.length`

### "Network request failed"
- Backend server not running → `npm run server`
- Wrong port → Check `.env` PORT setting
- CORS issue → Verify cors config in `server.cjs` includes your origin

### "Model not found" (404 from Anthropic)
- Wrong model name → Use correct format (see Model Names above)
- API key invalid → Check `.env` ANTHROPIC_API_KEY
- Rate limited → Wait or upgrade plan

### "State not updating"
- Async race condition → Capture values before await
- Reference vs value → Use spread operator for arrays/objects
- Not using setter → Must use `setState()` from useState

---

**Last Updated:** 2025-11-08

This guide is maintained alongside the codebase. Update it when making architectural changes or adding major features.
