---
name: llm
description: Multi-provider LLM integration. Unified interface for OpenAI, Anthropic, Google, and local models.
metadata:
  agdi:
    emoji: "🔮"
    always: true
    requires:
      bins: ["curl", "jq"]
---

# LLM 🔮

Multi-provider Large Language Model integration.

## Supported Providers

- OpenAI (GPT-4, GPT-4o, GPT-5.2)
- Anthropic (Claude 4.5 Opus, Claude 4.5 Sonnet)
- Google (Gemini 2.5 Pro)
- Groq (Llama 3.3)
- Local models (Ollama, LM Studio)

## Features

- Unified chat interface
- Model comparison
- Token counting
- Cost estimation
- Streaming responses
- Model routing based on task type

## Usage Examples

```
"Compare GPT-4 vs Claude on this task"
"Use local Llama model"
"Estimate tokens for this prompt"
"Route to the cheapest model for summarization"
```

## Integration with ModelRouter

This skill integrates with Agdi's ModelRouter to automatically select optimal models:

| Task | Recommended Model |
|------|-------------------|
| Planning | claude-4.5-opus |
| Coding | claude-4.5-sonnet |
| Chat | groq/llama-3.3 |
| Large Context | gemini-2.5-pro |
