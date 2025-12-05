# NeuraChat AI Service Layer

This directory contains the core logic for integrating various AI models and services into the NeuraChat backend. It's designed to be a modular, extensible, and configurable layer that provides a consistent interface for all AI-powered features.

## Architecture

The AI service is built around a provider-based pattern to decouple the core application logic from the specific AI model implementations.

-   **`AIService.ts`**: The main entry point and public-facing class for the AI layer. It orchestrates AI tasks like grammar correction, summarization, and agent-based chat. It delegates the actual AI calls to a configured "provider."

-   **`interfaces/AIProvider.ts`**: This interface defines the contract that all providers must adhere to. It ensures that `AIService` can switch between different AI backends (e.g., Ollama, Gemini) without changing its internal logic. The core methods are:
    -   `generate()`: For single-turn, prompt-based text generation.
    -   `chat()`: For multi-turn, conversational AI.
    -   `getAvailableModels()`: To discover and list models supported by the provider.

-   **`adapters/`**: This directory contains the concrete implementations (adapters) for different AI services. Each adapter implements the `AIProvider` interface.
    -   **`OllamaAdapter.ts`**: Connects to a local or remote Ollama instance.
    -   **`GeminiAdapter.ts`**: Connects to the Google Gemini API.
    -   **`HuggingFaceAdapter.ts`**: Connects to the Hugging Face Inference API.

-   **`config/prompts.ts`**: Stores all the system prompts used to instruct the AI models for specific tasks (e.g., grammar correction, tone change). This centralizes and standardizes the AI's behavior.

## Features

The `AIService` provides the following functionalities, which are exposed via the `aiController.ts`:

-   **Grammar Correction**: Corrects spelling and grammar mistakes.
-   **Summarization**: Creates a concise, single-sentence summary of a longer text.
-   **Message Enhancement**: Rewrites text for better clarity and professionalism.
-   **Message Expansion**: Expands a short input into a full, well-structured paragraph.
-   **Tone Adjustment**: Rewrites text to be `casual`, `formal`, or `empathetic`.
-   **Translation**: Translates text to a specified target language.
-   **AI Agent Chat**: A conversational agent that can remember recent messages in a session.
-   **Model Discovery**: Fetches a list of available models from the configured provider.

## Configuration

The AI layer is configured using environment variables in the `backend/.env` file.

```env
# --- AI Provider Configuration ---

# Specifies the default AI provider.
# Options: "ollama", "gemini", "huggingface"
AI_PROVIDER=ollama

# --- Ollama Configuration ---
# (Required if AI_PROVIDER is "ollama")
OLLAMA_HOST="http://localhost:11434"
OLLAMA_MODEL="llama3:latest" # Default model to use

# --- Google Gemini Configuration ---
# (Required if AI_PROVIDER is "gemini")
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# --- Hugging Face Configuration ---
# (Required if AI_PROVIDER is "huggingface")
HF_API_KEY="YOUR_HUGGING_FACE_API_KEY"
```

## Adding a New Provider

To add a new AI provider (e.g., for OpenAI):

1.  **Create a New Adapter**: Create a new file in `src/services/ai/adapters/`, for example, `OpenAIAdapter.ts`.
2.  **Implement `AIProvider`**: The new class must implement the `AIProvider` interface, providing logic for `generate()`, `chat()`, and `getAvailableModels()`.
3.  **Update `AIService`**: In `AIService.ts`, import the new adapter and add it to the `switch` statement in the constructor.
    ```typescript
    // In AIService.ts
    import { OpenAIAdapter } from './adapters/OpenAIAdapter';


    # NeuraChat AI Service

    This module powers NeuraChat's agentic copilot AI, supporting multi-provider LLMs (Gemini, HuggingFace, Ollama) and a dynamic, user-friendly toolset. All features are designed for extensibility, usability, and robust database alignment.

    ## Key Features

    - Multi-provider LLM support (Gemini, HuggingFace, Ollama)
    - Adapter pattern for easy provider integration
    - Agentic copilot with dynamic, extensible tools
    - All agent tools accept usernames and chat names (not IDs)
    - Table names and joins fully aligned with EERD
    - Supabase-backed chat, user, and AI history
    - REST and Socket.IO APIs

    ## Directory Structure

    - `AIService.ts`: Main entry for AI operations
    - `adapters/`: Provider adapters (Gemini, HuggingFace, Ollama)
    - `agent/AgentService.ts`: Agentic copilot orchestrator
    - `agent/tools/index.ts`: Agent tools (search, chat, notifications, etc.)
    - `agent/history/SupabaseHistory.ts`: Chat history via Supabase
    - `config/prompts.ts`: Prompt templates
    - `interfaces/AIProvider.ts`: Provider interface
    - `tests/`: Adapter and agent tests

    ## Usage

    1. Configure Supabase and providers in `.env`.
    2. Use `AIService` for direct LLM calls, or `AgentService` for agentic copilot features.
    3. All agent tools accept usernames and chat names for maximum usability (IDs are resolved internally).
    4. Table names and joins are strictly aligned with the EERD for robust querying and data integrity.

    ## Agentic Copilot Tools

    The agentic copilot exposes a rich set of tools, including:

    - Get current time
    - Search users (by username or full name)
    - Search messages (global and per-chat)
    - Summarize chat (last 10 messages)
    - Fetch notifications
    - Update user status message
    - Create chat (private/group, by usernames)
    - List user's chats
    - List chat participants
    - Get AI session history
    - Get call history
    - Get user profile

    See `agent/tools/index.ts` for full tool definitions and schemas. All tools are preference-aware and resolve names to IDs internally.

    ## Extending the Agent

    Add new tools in `agent/tools/index.ts` using the `DynamicStructuredTool` pattern. Always resolve names to IDs internally for user-friendliness. Follow EERD table naming for all queries.

    ## Testing

    Run tests in `tests/` to validate adapters and agent logic. Ensure new tools and features are covered.

    ## Notes

    - All queries use correct table names per EERD.
    - All tools are preference-aware and user-friendly.
    - Frontend integration is ongoing; backend is ready for agentic copilot features.
