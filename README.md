# Martivi Consulting Website

Next.js website with bilingual ChatWidget and AI-powered chat functionality.

## Environment Setup

To set up your local development environment, follow these steps:

1.  **Copy the example environment file:**
    ```bash
    cp .env.local.example .env.local
    ```
2.  **Edit the `.env.local` file:**
    Open the `.env.local` file and fill in the required values for the following variables:
    -   `OPENAI_API_KEY`: Your OpenAI API key.
    -   `PAGE_ACCESS_TOKEN`: Your Facebook Page Access Token.
    -   `VERIFY_TOKEN`: Your Facebook Webhook Verify Token.
    -   `EMAIL_USER`: Your email address for sending order notifications.
    -   `EMAIL_PASSWORD`: Your email password.
    -   `BANK_API_URL`: The URL of your bank's API.
    -   `BANK_API_TOKEN`: Your bank's API token.

    *Note: The `NEXT_PUBLIC_CHAT_API_BASE` and `NEXT_PUBLIC_GA_MEASUREMENT_ID` variables are not included in the `.env.local` file and are set elsewhere.*

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
