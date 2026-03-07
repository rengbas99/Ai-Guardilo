# Architecture Diagram: Grammar Enhancer Extension

## System Architecture

```mermaid
graph TB
    subgraph Browser["Browser Environment"]
        CS[Content Script<br/>content.js]
        UI[Popup UI<br/>popup.html/js]
    end
    
    subgraph Background["Background Service Worker"]
        BG[background.js]
        LLM[LLM Client<br/>llm-client.js]
        GH[GitHub Scraper<br/>github-scraper.js]
    end
    
    subgraph Utils["Utility Modules"]
        GC[Grammar Corrector<br/>grammar-corrector.js]
        PE[Prompt Enhancer<br/>prompt-enhancer.js]
        TP[Text Processor<br/>text-processor.js]
    end
    
    subgraph LocalLLM["Local LLM Services"]
        OLLAMA[Ollama<br/>localhost:11434]
        LMSTUDIO[LM Studio<br/>localhost:1234]
    end
    
    subgraph External["External Services"]
        GITHUB[GitHub API<br/>api.github.com]
    end
    
    subgraph Storage["Chrome Storage"]
        CONFIG[Configuration]
        CACHE[Cache & Results]
    end
    
    CS -->|Detect Input| GC
    CS -->|Detect Prompt| PE
    GC -->|Simple Rules| TP
    GC -->|Complex Cases| LLM
    PE -->|Optimize| LLM
    LLM -->|Request| OLLAMA
    LLM -->|Fallback| LMSTUDIO
    BG -->|Scrape| GH
    GH -->|API Calls| GITHUB
    UI -->|Configure| BG
    BG -->|Store| CONFIG
    GH -->|Cache| CACHE
    LLM -->|Store Results| CACHE
```

## Data Flow: Grammar Correction

```mermaid
sequenceDiagram
    participant User
    participant ContentScript
    participant GrammarCorrector
    participant RuleEngine
    participant LLMClient
    participant Ollama
    
    User->>ContentScript: Types/Pastes Text
    ContentScript->>GrammarCorrector: correct(text)
    GrammarCorrector->>RuleEngine: applyRules(text)
    RuleEngine-->>GrammarCorrector: Simple Corrections
    
    alt Simple Issues Found
        GrammarCorrector-->>ContentScript: Return Corrections
    else Complex Issues
        GrammarCorrector->>LLMClient: generate(prompt)
        LLMClient->>Ollama: POST /api/generate
        Ollama-->>LLMClient: Corrected Text
        LLMClient-->>GrammarCorrector: LLM Corrections
        GrammarCorrector-->>ContentScript: Combined Corrections
    end
    
    ContentScript->>User: Show Inline Suggestions
```

## Data Flow: Prompt Enhancement

```mermaid
sequenceDiagram
    participant User
    participant ContentScript
    participant PromptEnhancer
    participant LLMClient
    participant Ollama
    
    User->>ContentScript: Types Prompt in AI Chat
    ContentScript->>PromptEnhancer: detectPrompt(text)
    PromptEnhancer->>PromptEnhancer: Analyze Structure
    PromptEnhancer->>PromptEnhancer: Apply Rules
    
    PromptEnhancer->>LLMClient: enhance(prompt)
    LLMClient->>Ollama: POST /api/generate
    Note over Ollama: Optimize prompt using<br/>best practices
    Ollama-->>LLMClient: Enhanced Prompt
    LLMClient-->>PromptEnhancer: Optimized Version
    PromptEnhancer-->>ContentScript: Show Diff View
    ContentScript->>User: Display Before/After
```

## Component Interaction

```mermaid
graph LR
    subgraph Input["User Input"]
        TYPE[Typing]
        PASTE[Paste]
        FILE[File Upload]
    end
    
    subgraph Detection["Detection Layer"]
        DETECT[Content Script<br/>Monitors Input]
    end
    
    subgraph Processing["Processing Layer"]
        CHECK{Is Prompt?}
        GRAMMAR[Grammar<br/>Corrector]
        PROMPT[Prompt<br/>Enhancer]
    end
    
    subgraph Execution["Execution Layer"]
        RULES[Rule-Based<br/>Engine]
        LLM[LLM Client]
    end
    
    subgraph Output["Output Layer"]
        INLINE[Inline<br/>Suggestions]
        PILL[Floating<br/>Pill]
        DIFF[Diff View]
    end
    
    TYPE --> DETECT
    PASTE --> DETECT
    FILE --> DETECT
    
    DETECT --> CHECK
    CHECK -->|Yes| PROMPT
    CHECK -->|No| GRAMMAR
    
    PROMPT --> LLM
    GRAMMAR --> RULES
    GRAMMAR -->|Complex| LLM
    
    RULES --> INLINE
    LLM --> INLINE
    LLM --> PILL
    PROMPT --> DIFF
```

## LLM Fallback Strategy

```mermaid
graph TD
    START[User Input] --> CHECK1{LLM<br/>Enabled?}
    CHECK1 -->|No| RULES[Rule-Based Only]
    CHECK1 -->|Yes| CHECK2{Provider?}
    
    CHECK2 -->|Ollama| TRY1[Try Ollama]
    CHECK2 -->|LM Studio| TRY2[Try LM Studio]
    CHECK2 -->|Auto| TRY1
    
    TRY1 --> HEALTH1{Health<br/>Check}
    HEALTH1 -->|OK| USE1[Use Ollama]
    HEALTH1 -->|Fail| TRY2
    
    TRY2 --> HEALTH2{Health<br/>Check}
    HEALTH2 -->|OK| USE2[Use LM Studio]
    HEALTH2 -->|Fail| RULES
    
    USE1 --> PROCESS[Process Request]
    USE2 --> PROCESS
    RULES --> PROCESS
    
    PROCESS --> RESULT[Return Result]
```

## GitHub Scraper Flow

```mermaid
graph TD
    START[Background Sync] --> QUERY1[Query: free AI API]
    START --> QUERY2[Query: prompt enhancer]
    START --> QUERY3[Query: grammar corrector LLM]
    
    QUERY1 --> API1[GitHub API]
    QUERY2 --> API2[GitHub API]
    QUERY3 --> API3[GitHub API]
    
    API1 --> FILTER[Filter Results]
    API2 --> FILTER
    API3 --> FILTER
    
    FILTER -->|By Stars| STARS[Min 10 stars]
    FILTER -->|By License| LICENSE[MIT/Apache]
    FILTER -->|By Activity| ACTIVITY[Recent commits]
    
    STARS --> STORE[Store in Cache]
    LICENSE --> STORE
    ACTIVITY --> STORE
    
    STORE --> DISPLAY[Display in Popup]
```

## Storage Schema

```mermaid
graph LR
    STORAGE[Chrome Storage] --> CONFIG[Settings]
    STORAGE --> CACHE[Cache]
    STORAGE --> STATS[Statistics]
    
    CONFIG --> LLM_SETTINGS[LLM Config]
    CONFIG --> GRAMMAR_SETTINGS[Grammar Config]
    CONFIG --> PROMPT_SETTINGS[Prompt Config]
    
    CACHE --> GITHUB_RESULTS[GitHub Results]
    CACHE --> CORRECTIONS[Common Corrections]
    
    STATS --> TODAY[Today's Stats]
    STATS --> TOTAL[Total Stats]
```

