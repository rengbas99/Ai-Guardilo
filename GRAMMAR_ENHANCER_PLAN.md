# Complete Plan: Grammar Corrector & Prompt Enhancer Extension

## ✅ Feasibility Assessment: YES, This is 100% Possible

### Why This is Feasible:

1. **Existing Similar Solutions**:
   - **WritingTools** (GitHub: theJayTea/WritingTools) - System-wide grammar assistant with local LLM support
   - **Local LLM Prompt Enhancer** (GitHub: EricRollei/Local_LLM_Prompt_Enhancer) - Prompt optimization using local LLMs
   - **Grammit** - Chrome extension with local-only AI grammar checker
   - **AI-Text-Corrector** - AI-powered text correction (can be adapted for local LLMs)

2. **Technology Stack is Proven**:
   - Chrome Extensions can access localhost APIs (Ollama/LM Studio)
   - Local LLMs (Ollama, LM Studio) are mature and well-documented
   - GitHub API is publicly accessible for scraping
   - Your existing PII detector provides the perfect foundation/pattern

3. **No External Dependencies Required**:
   - All processing can be done locally
   - No API keys needed (uses local LLMs)
   - GitHub scraping uses public API (no auth needed)

---

## 📋 Complete Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

#### 1.1 Project Structure Setup
```
extension/
  src/
    content.js                    # Enhanced content script
    background.js                 # Service worker (LLM communication)
    utils/
      grammar-corrector.js        # Grammar correction engine
      prompt-enhancer.js          # Prompt optimization engine
      llm-client.js               # Local LLM client (Ollama/LM Studio)
      github-scraper.js           # GitHub API scraper
      text-processor.js           # Text analysis utilities
  popup/
    popup.html                    # Settings UI
    popup.js                      # Configuration management
    popup.css                     # Styling
  icons/                          # Extension icons
  manifest.json                   # Updated manifest
```

#### 1.2 Local LLM Client (`utils/llm-client.js`)

**Features:**
- Support for Ollama API (`http://localhost:11434/api/generate`)
- Support for LM Studio API (`http://localhost:1234/v1/chat/completions`)
- Health check endpoint
- Model selection and configuration
- Error handling and retry logic
- Fallback mechanism

**API Endpoints:**
```javascript
// Ollama
POST http://localhost:11434/api/generate
{
  "model": "llama3.2",
  "prompt": "Correct this grammar: ...",
  "stream": false
}

// LM Studio (OpenAI-compatible)
POST http://localhost:1234/v1/chat/completions
{
  "model": "local-model",
  "messages": [{"role": "user", "content": "..."}]
}
```

**Implementation Strategy:**
1. Try Ollama first (default)
2. Fallback to LM Studio if Ollama unavailable
3. Cache connection status
4. Show user-friendly error messages if both unavailable

#### 1.3 Grammar Corrector (`utils/grammar-corrector.js`)

**Two-Tier Approach:**

**Tier 1: Rule-Based (Fast, Local)**
- Common grammar mistakes (their/there, your/you're, etc.)
- Spelling corrections (common words)
- Punctuation fixes
- Basic style improvements

**Tier 2: LLM-Based (Complex Cases)**
- Context-aware corrections
- Advanced grammar issues
- Style and clarity improvements
- Tone adjustments

**Flow:**
```
User Input → Rule-Based Check → Issues Found?
  ├─ Yes (Simple) → Apply Rules → Done
  └─ No/Complex → Send to Local LLM → Get Suggestions → Display
```

#### 1.4 Prompt Enhancer (`utils/prompt-enhancer.js`)

**Optimization Rules:**
1. **Structure**: Ensure clear task definition
2. **Clarity**: Remove ambiguity
3. **Specificity**: Add concrete details
4. **Token Efficiency**: Remove redundancy
5. **Best Practices**: Apply prompt engineering techniques

**Detection:**
- Identify AI chat interfaces (ChatGPT, Claude, Perplexity)
- Detect prompt-like text (questions, instructions)
- Analyze prompt structure

**Enhancement Process:**
```
Detect Prompt → Analyze Structure → Apply Rules → LLM Enhancement → Show Diff
```

#### 1.5 GitHub Scraper (`utils/github-scraper.js`)

**Search Strategy:**
- Query: "free AI API", "prompt enhancer", "grammar corrector LLM"
- Filter by: Stars (>10), Recent activity, License (MIT/Apache)
- Store in `chrome.storage.local`
- Background sync every 24 hours

**GitHub API Endpoints:**
```
GET https://api.github.com/search/repositories?q=free+AI+API&sort=stars&order=desc
GET https://api.github.com/search/repositories?q=prompt+enhancer&sort=stars&order=desc
GET https://api.github.com/search/repositories?q=grammar+corrector+LLM&sort=stars&order=desc
```

**Rate Limiting:**
- Unauthenticated: 60 requests/hour
- Cache results to minimize API calls
- Batch requests intelligently

---

### Phase 2: Content Script Integration (Week 2)

#### 2.1 Enhanced Content Script (`content.js`)

**Features:**
- Monitor text input (similar to PII detector)
- Real-time grammar checking (debounced)
- Inline suggestions (Grammarly-style)
- Floating pill UI for corrections
- Prompt enhancement detection

**Detection Logic:**
```javascript
// Detect input changes
input.addEventListener('input', debounce(() => {
  const text = input.value;
  
  // Check if it's a prompt (AI chat context)
  if (isAIChatContext()) {
    enhancePrompt(text);
  } else {
    correctGrammar(text);
  }
}, 500));
```

**UI Components:**
1. **Inline Underlines**: Red wavy underlines for errors
2. **Tooltips**: Hover to see suggestions
3. **Floating Pill**: Summary of all corrections
4. **Diff View**: Show before/after for prompt enhancement

#### 2.2 Background Service Worker (`background.js`)

**Responsibilities:**
- Handle LLM API calls (cross-origin requests)
- Manage GitHub scraper background sync
- Store configuration and cache
- Handle messages from content script

**Message Types:**
```javascript
// Grammar correction request
{ type: 'CORRECT_GRAMMAR', text: '...' }

// Prompt enhancement request
{ type: 'ENHANCE_PROMPT', text: '...' }

// LLM health check
{ type: 'CHECK_LLM', provider: 'ollama' | 'lmstudio' }

// GitHub scrape request
{ type: 'SCRAPE_GITHUB', query: '...' }
```

---

### Phase 3: UI and Configuration (Week 2-3)

#### 3.1 Popup Settings UI (`popup/popup.html`)

**Sections:**
1. **LLM Configuration**
   - Provider selection (Ollama/LM Studio)
   - API endpoint configuration
   - Model selection
   - Connection status indicator

2. **Grammar Settings**
   - Enable/disable grammar correction
   - Correction level (basic/advanced)
   - Auto-correct vs. suggestions only

3. **Prompt Enhancement**
   - Enable/disable prompt enhancement
   - Enhancement level
   - Auto-enhance vs. manual trigger

4. **GitHub Scraper**
   - Discovered tools list
   - Last sync time
   - Manual refresh button

5. **Statistics**
   - Corrections made today
   - Prompts enhanced
   - LLM usage stats

#### 3.2 Configuration Management (`popup/popup.js`)

**Storage Schema:**
```javascript
{
  settings: {
    llm: {
      provider: 'ollama' | 'lmstudio',
      ollamaUrl: 'http://localhost:11434',
      lmStudioUrl: 'http://localhost:1234',
      model: 'llama3.2',
      enabled: true
    },
    grammar: {
      enabled: true,
      level: 'advanced', // 'basic' | 'advanced'
      autoCorrect: false
    },
    prompt: {
      enabled: true,
      level: 'moderate', // 'light' | 'moderate' | 'aggressive'
      autoEnhance: false
    },
    github: {
      lastSync: timestamp,
      discoveredTools: [...]
    }
  }
}
```

---

### Phase 4: Advanced Features (Week 3-4)

#### 4.1 Context-Aware Suggestions
- Learn from user corrections
- Adapt to writing style
- Domain-specific improvements

#### 4.2 Multi-Language Support
- Detect language
- Support multiple languages
- Language-specific grammar rules

#### 4.3 Custom Rules
- User-defined grammar rules
- Custom prompt templates
- Personal writing style preferences

---

## 🔧 Technical Implementation Details

### Manifest Updates (`manifest.json`)

```json
{
  "manifest_version": 3,
  "name": "Grammar Enhancer & Prompt Optimizer",
  "version": "2.0.0",
  "permissions": [
    "activeTab",
    "storage",
    "clipboardWrite"
  ],
  // Note: "clipboardWrite" permission is used when users accept grammar corrections
  // or prompt enhancements - the extension writes the corrected/enhanced text to
  // the clipboard as a convenience feature. This is optional functionality; users
  // can disable this behavior by not using the "Accept" button that triggers clipboard
  // writes. If clipboard writes are not essential, this permission can be removed to
  // reduce the security footprint.
  "host_permissions": [
    "http://localhost:11434/*",
    "http://localhost:1234/*",
    "https://api.github.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://chat.openai.com/*",
        "https://chatgpt.com/*",
        "https://claude.ai/*",
        "https://www.perplexity.ai/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  // Note: The overly broad "https://*/*" pattern has been removed. Instead, use one of:
  // 1. Curated matches list (as shown above) - only inject on known AI chat sites
  // 2. Remove content_scripts entirely and use activeTab permission + chrome.scripting.executeScript
  //    to dynamically inject content.js when user triggers it or based on whitelist logic
  // 3. Implement user-configurable domain whitelist that background service worker checks
  //    before calling chrome.scripting.executeScript for content.js injection
}
```

### LLM Client Implementation

```javascript
// utils/llm-client.js
export class LLMClient {
  constructor(provider = 'ollama') {
    this.provider = provider;
    this.baseUrl = provider === 'ollama' 
      ? 'http://localhost:11434' 
      : 'http://localhost:1234';
  }

  async generate(prompt, model = 'llama3.2') {
    if (this.provider === 'ollama') {
      return this.ollamaGenerate(prompt, model);
    } else {
      return this.lmStudioGenerate(prompt, model);
    }
  }

  async ollamaGenerate(prompt, model) {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false
        })
      });
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.response) {
        throw new Error('Ollama response missing "response" field');
      }
      
      return data.response;
    } catch (error) {
      console.error('Ollama generation error:', error);
      throw new Error(`Failed to generate with Ollama: ${error.message}`);
    }
  }

  async lmStudioGenerate(prompt, model) {
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      
      if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new Error('LM Studio response missing expected structure (choices[0].message.content)');
      }
      
      return data.choices[0].message.content;
    } catch (error) {
      console.error('LM Studio generation error:', error);
      throw new Error(`Failed to generate with LM Studio: ${error.message}`);
    }
  }

  async healthCheck() {
    // Respect the provider configured in the instance
    if (this.provider === 'ollama') {
      try {
        const response = await fetch(`${this.baseUrl}/api/tags`);
        return response.ok;
      } catch {
        return false;
      }
    } else if (this.provider === 'lmstudio') {
      try {
        const response = await fetch(`${this.baseUrl}/v1/models`);
        return response.ok;
      } catch {
        return false;
      }
    } else {
      // Unknown provider - try both endpoints
      try {
        const ollamaResponse = await fetch(`${this.baseUrl}/api/tags`);
        if (ollamaResponse.ok) return true;
      } catch {}
      try {
        const lmStudioResponse = await fetch(`${this.baseUrl}/v1/models`);
        if (lmStudioResponse.ok) return true;
      } catch {}
      return false;
    }
  }
}
```

### Grammar Corrector Implementation

```javascript
// utils/grammar-corrector.js
export class GrammarCorrector {
  constructor(llmClient) {
    this.llmClient = llmClient;
    this.rules = this.initRules();
  }

  async correct(text) {
    // Tier 1: Rule-based
    const ruleBasedCorrections = this.applyRules(text);
    
    // Partition rule-based results by confidence
    const highConfidenceCorrections = ruleBasedCorrections.filter(c => c.confidence > 0.9);
    const lowConfidenceCorrections = ruleBasedCorrections.filter(c => c.confidence <= 0.9);
    
    // If high-confidence corrections cover all issues, skip LLM call
    if (highConfidenceCorrections.length > 0 && lowConfidenceCorrections.length === 0) {
      return highConfidenceCorrections;
    }

    // Tier 2: LLM-based for complex cases (only when needed)
    const llmCorrections = await this.llmCorrect(text);
    
    // Merge and deduplicate corrections
    const allCorrections = [...highConfidenceCorrections, ...llmCorrections];
    return this.deduplicateCorrections(allCorrections);
  }
  
  deduplicateCorrections(corrections) {
    // Remove duplicate corrections based on position and text
    const seen = new Set();
    return corrections.filter(c => {
      const key = `${c.start}-${c.end}-${c.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  applyRules(text) {
    const corrections = [];
    // Common mistakes: their/there, your/you're, etc.
    // Implementation details...
    return corrections;
  }

  async llmCorrect(text) {
    // Request structured JSON that matches what parseLLMResponse expects
    const prompt = `Correct the grammar and improve clarity of this text. Return a JSON object with this structure:
{
  "corrected": "the corrected version of the text",
  "changes": [
    {"original": "original text", "corrected": "corrected text", "start": 0, "end": 10}
  ]
}

Original text:\n\n${text}`;
    
    const corrected = await this.llmClient.generate(prompt);
    return this.parseLLMResponse(corrected, text);
  }
  
  // Alternative: If keeping plain text response, update parseLLMResponse to handle it:
  // parseLLMResponse(corrected, original) {
  //   // Run text-diff between original and LLM output to extract edits
  //   // Return array of correction objects with start, end, original, corrected
  // }
}
```

---

## 🚀 Development Roadmap

### Week 1: Foundation
- [x] Project structure setup
- [ ] LLM client implementation
- [ ] Basic grammar corrector (rule-based)
- [ ] GitHub scraper skeleton

### Week 2: Core Features
- [ ] Content script integration
- [ ] Inline suggestion UI
- [ ] Prompt enhancer implementation
- [ ] Background service worker

### Week 3: UI and Polish
- [ ] Popup settings UI
- [ ] Configuration management
- [ ] Error handling and edge cases
- [ ] Testing and debugging

### Week 4: Advanced Features
- [ ] Context-aware suggestions
- [ ] GitHub scraper full implementation
- [ ] Performance optimization
- [ ] Documentation

---

## ⚠️ Challenges and Solutions

### Challenge 1: Localhost CORS
**Problem**: Chrome extensions need permission to access localhost APIs.

**Solution**: Add `host_permissions` in manifest.json for localhost URLs.

### Challenge 2: LLM Availability
**Problem**: User might not have Ollama/LM Studio running.

**Solution**: 
- Health check before making requests
- Clear error messages with setup instructions
- Fallback to rule-based only mode

### Challenge 3: Performance
**Problem**: LLM calls can be slow (2-5 seconds).

**Solution**:
- Debounce input detection (500ms delay)
- Cache common corrections
- Show loading indicators
- Process in background
- **Add request timeout** (5-10 seconds) for LLM calls
- **Support AbortController/abort signal** to cancel in-flight requests when user continues typing
- **Graceful degradation**: Fall back to rule-based corrections on timeout
- Clear timeouts when responses arrive

**Example implementation**:
```javascript
async generate(prompt, model, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      // ... other options
    });
    clearTimeout(timeoutId);
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('LLM request timed out');
    }
    throw error;
  }
}
```

### Challenge 4: GitHub API Rate Limits
**Problem**: 60 requests/hour unauthenticated.

**Solution**:
- Cache results aggressively
- Batch multiple queries
- Sync in background (not on-demand)
- Optional: Support GitHub token for higher limits

---

## 📊 Similar Existing Solutions

### 1. WritingTools
- **GitHub**: theJayTea/WritingTools
- **Features**: System-wide grammar assistant, local LLM support
- **Our Advantage**: Chrome extension (works in browser), prompt enhancement

### 2. Local LLM Prompt Enhancer
- **GitHub**: EricRollei/Local_LLM_Prompt_Enhancer
- **Features**: Prompt optimization for AI generation
- **Our Advantage**: Real-time in-browser, grammar correction too

### 3. Grammit
- **Type**: Chrome extension
- **Features**: Local-only grammar checker
- **Our Advantage**: Prompt enhancement, GitHub scraper, more features

---

## ✅ Success Criteria

1. **Functionality**:
   - ✅ Grammar correction works on any website
   - ✅ Prompt enhancement works on AI chat sites
   - ✅ Local LLM integration (Ollama/LM Studio)
   - ✅ GitHub scraper discovers relevant tools

2. **Performance**:
   - ✅ Rule-based corrections: < 50ms
   - ✅ LLM corrections: < 3 seconds
   - ✅ No noticeable lag in typing

3. **User Experience**:
   - ✅ Clear inline suggestions
   - ✅ Easy configuration
   - ✅ Helpful error messages
   - ✅ Works offline (rule-based mode)

---

## 🎯 Next Steps

1. **Start Implementation**: Begin with Phase 1 (Core Infrastructure)
2. **Test Incrementally**: Test each component as you build
3. **Iterate**: Get feedback and improve
4. **Document**: Keep documentation updated

---

## 📝 Notes

- **No Marketing/Agentic Lighting**: As requested, this is a pure utility tool
- **Privacy-First**: All processing local, no data sent to external servers
- **Extensible**: Architecture supports future desktop app expansion
- **Open Source Ready**: Can be open-sourced if desired

---

**Conclusion**: This project is 100% feasible and builds on proven technologies. The existing PII detector provides an excellent foundation. Start with Phase 1 and iterate from there.

