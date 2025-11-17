# Martivi Consulting Website

Next.js website with bilingual ChatWidget and AI-powered chat functionality.

## Environment Setup

Required environment variables in `.env.local`:
```
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_CHAT_API_BASE=https://mc-chat-230925-43vp.vercel.app
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-4XZ9W578J6
```

## Development

```bash
npm run dev
```

## Deployment

### Main Website (with ChatWidget)
```bash
vercel --prod --yes
```

### API Only (separate deployment)
```bash
cd deployments/vercel-api
vercel --prod
```

### Static Export (for non-Vercel hosting)
```bash
npm run build
# Upload the 'out' folder to your static hosting
```

## Current Deployments

- **Main Site**: https://martivi-consulting-website-kvvkh4ax9-giorgis-projects-cea59354.vercel.app
- **API Endpoint**: https://mc-chat-230925-43vp.vercel.app/api/chat
- **Static Site**: martiviconsulting.com (upload `out` folder)

## ChatWidget Features

- Bilingual support (Georgian/English)
- URL-based language detection (`/ka` for Georgian)
- Auto-start conversation
- Lead capture form
- Google Analytics tracking
# Bebias-chatbot
