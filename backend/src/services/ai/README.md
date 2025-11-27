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

    // ... in constructor
    switch (providerType) {
      // ... other cases
      case 'openai':
        this.provider = new OpenAIAdapter();
        break;
      // ...
    }
    ```
4.  **Update `.env`**: Add any required environment variables (like `OPENAI_API_KEY`) to the `.env` file and the documentation.

## Testing

A test script is available to verify that the configured AI provider is working correctly. It tests grammar correction, summarization, and agent chat.

To run the tests, execute the following command from the `backend/` directory:

```bash
ts-node src/services/ai/tests/test-adapters.ts
```

Make sure your `.env` file is properly configured before running the test.
