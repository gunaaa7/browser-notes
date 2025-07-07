# SideNote

A comprehensive note-taking application with AI integration, voice recording capabilities, and browser extension functionality.

## Features

- 🎤 **Voice Recording**: Record and transcribe voice notes using Deepgram
- 🤖 **AI Integration**: Chat with AI using OpenAI and Anthropic models
- 🖼️ **Image Generation**: Generate images using Replicate's Stable Diffusion
- 📱 **Browser Extension**: Side panel functionality for quick note-taking
- 🔐 **Authentication**: Secure login with Firebase Auth
- ☁️ **Cloud Storage**: Save and sync notes with Firebase Database and Storage
- 📤 **Image Upload**: Upload and manage images

## Technologies Used

- **Frontend**: React with Next.js 14 App Router
- **Styling**: TailwindCSS
- **Backend**: Firebase Auth, Storage, and Database
- **AI Services**: OpenAI, Anthropic, Replicate via Vercel AI SDK
- **Voice Processing**: Deepgram API for real-time transcription
- **Browser Extension**: Chrome Extension API

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── api/            # API routes for AI services
│   └── components/     # React components
├── lib/                # Utilities and contexts
│   ├── contexts/       # React contexts for auth and Deepgram
│   ├── firebase/       # Firebase configuration and utils
│   └── hooks/          # Custom React hooks
├── icons/              # Extension icons
├── manifest.json       # Chrome extension manifest
├── background.js       # Extension background script
├── content.js         # Extension content script
└── sidepanel.html/js   # Extension side panel
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables for Firebase and AI services

3. Run the development server:
   ```bash
   npm run dev
   ```

4. For browser extension development, load the `src` folder as an unpacked extension in Chrome

## Template Credit

This project was built using the full-stack template from [@https://github.com/ansh/template-2](https://github.com/ansh/template-2) as a starting point.