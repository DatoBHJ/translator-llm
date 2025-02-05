# Real-Time AI Voice Translator 

1. Name two languages
2. Start speaking in either language
3. Get instant translations

![Translation Interface](./assets/images/0.png)
![Voice Settings](./assets/images/1.png)

[![Next.js](https://img.shields.io/badge/Next.js-14.2.3-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)

STT, language detection, and translation powered by Groq.
C-3PO voice clone & auto TTS using ElevenLabs.
whisper-large-v3 for STT. deepseek-r1 for translation.

> Try it now: [nametwolangs.com](https://www.nametwolangs.com/)

## A simpler translator

Built for simplicity - auto-detects languages, clean minimal interface, no endless scrolling through language options, minimal buttons. Just name 2 languages and you're ready to translate.

> STT & translation work great, but iOS autoplay rules make auto TTS a bit fussy. 

## Quick Start
1. Install dependencies
```bash
npm install
```

2. Set environment variables (.env)
```env
# Required for default translation
GROQ_API_KEY=your_groq_key

# Optional for TTS
ELEVENLABS_API_KEY=your_elevenlabs_key

# Optional for alternative models
DEEPSEEK_API_KEY=your_deepseek_key
OPENAI_API_KEY=your_openai_key
```

3. Start development server
```bash
npm run dev
```

## Model Configuration

You can switch between models by modifying `lib/config/translation.ts`:

