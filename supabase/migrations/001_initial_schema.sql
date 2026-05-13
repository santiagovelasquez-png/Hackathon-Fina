-- OpenScout AI — Initial Schema
-- Run this against your Supabase project via the SQL editor or CLI

-- ── Extensions ───────────────────────────────────────────────────────────────

-- pgvector available for v2 (embeddings + semantic search)
-- create extension if not exists vector;

-- ── Profiles ─────────────────────────────────────────────────────────────────

create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text,
  email       text,
  avatar_url  text,
  created_at  timestamptz default now() not null
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Companies ─────────────────────────────────────────────────────────────────

create table if not exists companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sector      text,
  created_at  timestamptz default now() not null
);

create table if not exists company_members (
  company_id  uuid not null references companies on delete cascade,
  user_id     uuid not null references profiles on delete cascade,
  role        text not null check (role in ('owner', 'recruiter', 'viewer')),
  created_at  timestamptz default now() not null,
  primary key (company_id, user_id)
);

-- ── Candidates (pool — no company_id) ────────────────────────────────────────

create table if not exists candidates (
  id                uuid primary key default gen_random_uuid(),
  public_utl        jsonb not null default '{}',   -- PublicUTL schema — NO PII
  confidence_score  float check (confidence_score >= 0 and confidence_score <= 1),
  source_type       text not null check (source_type in ('pdf', 'image', 'form', 'text', 'audio')),
  raw_storage_path  text,
  ingested_at       timestamptz default now() not null,
  version           integer not null default 1
);

-- ── PII (completely separate table) ──────────────────────────────────────────

create table if not exists candidate_private_data (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null unique references candidates on delete cascade,
  full_name     text,
  email         text,
  phone         text,
  linkedin_url  text,
  portfolio_url text,
  created_at    timestamptz default now() not null
);

-- ── Consent and Access ────────────────────────────────────────────────────────

create table if not exists candidate_consents (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates on delete cascade,
  company_id    uuid not null references companies on delete cascade,
  granted_at    timestamptz default now() not null,
  scope         text[] not null default '{}',  -- ['pii_view', 'report_view', 'contact']
  revoked_at    timestamptz,
  unique (candidate_id, company_id)
);

create table if not exists candidate_company_access (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates on delete cascade,
  company_id   uuid not null references companies on delete cascade,
  granted_by   uuid references profiles,
  access_level text not null check (access_level in ('profile_summary', 'full_utl', 'pii')),
  granted_at   timestamptz default now() not null,
  expires_at   timestamptz,
  unique (candidate_id, company_id)
);

-- ── Jobs ─────────────────────────────────────────────────────────────────────

create table if not exists jobs (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies on delete cascade,
  utl_job_profile  jsonb not null default '{}',   -- UTLJobProfile schema
  status           text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  created_at       timestamptz default now() not null
);

-- ── Scoring (internal — companies do NOT query this directly) ─────────────────

create table if not exists candidate_scores (
  id               uuid primary key default gen_random_uuid(),
  candidate_id     uuid not null references candidates on delete cascade,
  job_id           uuid not null references jobs on delete cascade,
  total_score      float not null check (total_score >= 1 and total_score <= 10),
  breakdown        jsonb not null default '[]',   -- ScoreDimension[]
  exclusion_reason text,
  engine_version   text not null,
  computed_at      timestamptz default now() not null,
  unique (candidate_id, job_id)
);

-- ── Ranking (what companies see) ──────────────────────────────────────────────

create table if not exists ranking_results (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies on delete cascade,
  job_id          uuid not null references jobs on delete cascade,
  candidate_id    uuid not null references candidates on delete cascade,
  score_snapshot  float not null check (score_snapshot >= 1 and score_snapshot <= 10),
  rank            integer not null,
  profile_summary jsonb not null default '{}',  -- ProfileSummary schema (redacted)
  pii_unlocked    boolean not null default false,
  created_at      timestamptz default now() not null,
  unique (job_id, candidate_id)
);

-- ── Normalized Inputs (trazabilidad — candidates AND jobs) ────────────────────

create table if not exists normalized_inputs (
  id                uuid primary key default gen_random_uuid(),
  candidate_id      uuid references candidates on delete cascade,   -- nullable
  job_id            uuid references jobs on delete cascade,          -- nullable
  raw_text          text,
  adapter_used      text not null check (adapter_used in ('pdf', 'vision', 'passthrough', 'manual')),
  ai_draft          jsonb,
  validation_errors jsonb,
  created_at        timestamptz default now() not null,
  check (candidate_id is not null or job_id is not null)
);

-- ── Interview Sessions ────────────────────────────────────────────────────────

create table if not exists interview_sessions (
  id                     uuid primary key default gen_random_uuid(),
  candidate_id           uuid not null references candidates on delete cascade,
  job_id                 uuid references jobs on delete set null,
  channel                text not null check (channel in ('simulator', 'telegram')),
  status                 text not null default 'pending'
                           check (status in ('pending', 'in_progress', 'completed', 'abandoned')),
  current_question_index integer not null default 0,
  answers                jsonb not null default '[]',
  access_token_hash      text,                -- hash of token for login-free access
  expires_at             timestamptz,
  started_at             timestamptz default now() not null,
  completed_at           timestamptz
);

-- ── Interview Evaluations (AI proposes, engine confirms) ──────────────────────

create table if not exists interview_evaluations (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references interview_sessions on delete cascade,
  question_id     text not null,
  answer_text     text not null,
  competency_name text not null,
  proposed_score  float not null check (proposed_score >= 1 and proposed_score <= 10),
  final_score     float check (final_score >= 1 and final_score <= 10),
  explanation     text not null,
  rubric_applied  text not null,
  created_at      timestamptz default now() not null
);

-- ── Invitations ───────────────────────────────────────────────────────────────

create table if not exists invitations (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies on delete cascade,
  job_id        uuid not null references jobs on delete cascade,
  candidate_id  uuid not null references candidates on delete cascade,
  sent_by       uuid references profiles,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined', 'expired')),
  sent_at       timestamptz default now() not null,
  responded_at  timestamptz,
  unique (job_id, candidate_id)
);

-- ── Reports ───────────────────────────────────────────────────────────────────

create table if not exists reports (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies on delete cascade,
  job_id        uuid references jobs on delete set null,
  generated_at  timestamptz default now() not null,
  format        text not null check (format in ('html', 'email', 'pdf')),
  storage_path  text,
  candidate_ids uuid[] not null default '{}',
  score_snapshot jsonb not null default '[]',
  pii_included  boolean not null default false
);

-- ── Audit Logs ────────────────────────────────────────────────────────────────

create table if not exists audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references profiles,
  company_id    uuid references companies,
  action        text not null,
  resource_type text not null,
  resource_id   uuid,
  metadata      jsonb default '{}',
  created_at    timestamptz default now() not null
);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table companies enable row level security;
alter table company_members enable row level security;
alter table candidates enable row level security;
alter table candidate_private_data enable row level security;
alter table candidate_consents enable row level security;
alter table candidate_company_access enable row level security;
alter table jobs enable row level security;
alter table candidate_scores enable row level security;
alter table ranking_results enable row level security;
alter table normalized_inputs enable row level security;
alter table interview_sessions enable row level security;
alter table interview_evaluations enable row level security;
alter table invitations enable row level security;
alter table reports enable row level security;
alter table audit_logs enable row level security;

-- Profiles: users see their own
create policy "profile_self" on profiles
  for all using (id = auth.uid());

-- Companies: members see their company
create policy "company_member_read" on companies
  for select using (
    id in (select company_id from company_members where user_id = auth.uid())
  );

create policy "company_member_insert" on companies
  for insert with check (true); -- any authed user can create a company

-- Company members: members see their own memberships
create policy "company_members_read" on company_members
  for select using (
    company_id in (select company_id from company_members where user_id = auth.uid())
  );

create policy "company_members_insert" on company_members
  for insert with check (user_id = auth.uid()); -- users add themselves

-- Candidates: visible if in ranking_results or candidate_company_access for this company
create policy "candidate_via_ranking" on candidates
  for select using (
    id in (
      select candidate_id from ranking_results
      where company_id in (select company_id from company_members where user_id = auth.uid())
    )
    or
    id in (
      select candidate_id from candidate_company_access
      where company_id in (select company_id from company_members where user_id = auth.uid())
    )
  );

-- Service role can insert candidates (ingest API uses service role key)
create policy "candidate_service_insert" on candidates
  for insert with check (auth.role() = 'service_role');

-- candidate_private_data: only with active consent + pii access level
create policy "pii_restricted" on candidate_private_data
  for select using (
    candidate_id in (
      select cc.candidate_id from candidate_consents cc
      where cc.company_id in (select company_id from company_members where user_id = auth.uid())
        and 'pii_view' = any(cc.scope)
        and cc.revoked_at is null
    )
    and
    candidate_id in (
      select cca.candidate_id from candidate_company_access cca
      where cca.access_level = 'pii'
        and cca.company_id in (select company_id from company_members where user_id = auth.uid())
    )
  );

-- Jobs: company members see their jobs
create policy "jobs_company_read" on jobs
  for select using (
    company_id in (select company_id from company_members where user_id = auth.uid())
  );

create policy "jobs_company_write" on jobs
  for all using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid() and role in ('owner', 'recruiter')
    )
  );

-- Ranking: company sees their own rankings
create policy "ranking_company_read" on ranking_results
  for select using (
    company_id in (select company_id from company_members where user_id = auth.uid())
  );

create policy "ranking_service_write" on ranking_results
  for all with check (auth.role() = 'service_role');

-- candidate_scores: internal — service role only
create policy "scores_service_only" on candidate_scores
  for all using (auth.role() = 'service_role');

-- Reports: company members read their reports
create policy "reports_company_read" on reports
  for select using (
    company_id in (select company_id from company_members where user_id = auth.uid())
  );

create policy "reports_service_write" on reports
  for all with check (auth.role() = 'service_role');

-- Audit logs: company owners see their own logs
create policy "audit_company_read" on audit_logs
  for select using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "audit_service_write" on audit_logs
  for insert with check (auth.role() = 'service_role');

-- Invitations: company members see their invitations
create policy "invitations_company_read" on invitations
  for select using (
    company_id in (select company_id from company_members where user_id = auth.uid())
  );

-- Interview sessions: service role manages, access_token_hash verified in app layer
create policy "sessions_service" on interview_sessions
  for all using (auth.role() = 'service_role');

create policy "sessions_company_read" on interview_sessions
  for select using (
    candidate_id in (
      select candidate_id from ranking_results
      where company_id in (select company_id from company_members where user_id = auth.uid())
    )
  );

-- Interview evaluations: accessible via session ownership
create policy "evaluations_service" on interview_evaluations
  for all using (auth.role() = 'service_role');

-- Normalized inputs: service role only (internal trazabilidad)
create policy "normalized_inputs_service" on normalized_inputs
  for all using (auth.role() = 'service_role');

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_company_members_user on company_members(user_id);
create index if not exists idx_company_members_company on company_members(company_id);
create index if not exists idx_ranking_job on ranking_results(job_id);
create index if not exists idx_ranking_company on ranking_results(company_id);
create index if not exists idx_candidate_scores_job on candidate_scores(job_id);
create index if not exists idx_interview_sessions_candidate on interview_sessions(candidate_id);
create index if not exists idx_audit_logs_company on audit_logs(company_id);
create index if not exists idx_audit_logs_actor on audit_logs(actor_id);
