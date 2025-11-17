# Task Plan — Chatbot with File-backed Q&A & Cleanup

Goal: Build a deployable (Vercel-ready) chatbot based on this repository that can connect to a file (e.g., products.json / CSV) and answer questions about product availability, price, and characteristics. Remove unneeded files from the repo and provide deployment instructions.

Checklist:
- [x] Create todo list
- [ ] Analyze repository and identify files to keep / remove
- [ ] Design product data schema and decide storage location (e.g., `data/products.json` or `public/products.csv`)
- [ ] Add example product dataset (JSON/CSV) and loader
- [ ] Implement backend API route to read the data file and answer structured queries
  - [ ] Provide endpoints: `/api/products` (list/query), `/api/chat` (chat-style Q&A)
  - [ ] Implement search/filter for availability, price, and attributes
- [ ] Integrate chat UI with existing components (e.g., `ChatWidget` / `ClientChatWidget`) to call backend
  - [ ] Allow file-based lookups from chat flow
  - [ ] Add safeguards and clear error messages on missing data
- [ ] Add unit/integration tests for data API and chat endpoint
- [ ] Remove or archive unneeded files & folders (e.g., unused `deployments/` archives, duplicate public copies)
- [ ] Update README with usage and Vercel deployment instructions
- [ ] Run local manual tests (start dev server, exercise chat with sample queries)
- [ ] Deploy to Vercel and validate production behavior

Notes / Implementation details
- Preferred approach:
  - Add new data folder `data/products.json` with sample records: id, name, price, stock, attributes.
  - Implement a serverless API route (Next.js app dir: `app/api/products/route.ts` and `app/api/chat/route.ts`) that reads the JSON file using fs (or from `public/` if simpler).
  - The `/api/products` endpoint supports query params (q, id, minPrice, maxPrice, inStock) and returns filtered results.
  - The `/api/chat` endpoint accepts a simple prompt and uses deterministic matching (product search + templated response). If you prefer LLM-style answers later, we can integrate an LLM provider.
  - Update or reuse `components/ChatWidget.tsx` to call `/api/chat` and show responses.
- Cleanup suggestions:
  - Move large archived zips and `deployments/` to an `archive/` folder or remove if not needed.
  - Keep `app/`, `components/`, `public/` (images used by site), `package.json`, and config files needed for Vercel.
  - Remove duplicate `deployments/nodejs-api/` if it mirrors `app/` contents.
- Next step (with your approval): I will scan the repository to identify candidate files/folders to remove and create the data API and example data. Confirm that you want me to:
  - (A) Automatically delete the unneeded files I identify, or
  - (B) Move them into an `archive/` folder so nothing is permanently lost.
