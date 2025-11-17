-- Optional: analytics table to log anonymized interactions
create table if not exists public.chatbot_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  lang text,
  question text,
  intent text,
  session_id text
);

-- Helpful index
create index if not exists chatbot_events_created_idx on public.chatbot_events (created_at desc);
