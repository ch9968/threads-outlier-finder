-- Add idempotency and data integrity constraints
-- Per Phase 1 eng review: webhook idempotency, schema constraints

-- Add dataset_id column for debugging and reconciliation
ALTER TABLE scrape_jobs ADD COLUMN IF NOT EXISTS dataset_id TEXT;

-- Add unique constraint on apify_run_id (prevent duplicate webhook processing)
-- Allow NULL (job starts without run_id, gets updated after Apify call)
CREATE UNIQUE INDEX IF NOT EXISTS idx_scrape_jobs_apify_run_id
  ON scrape_jobs(apify_run_id) WHERE apify_run_id IS NOT NULL;

-- Add CHECK constraint on status
ALTER TABLE scrape_jobs
  ADD CONSTRAINT scrape_jobs_status_check
  CHECK (status IN ('pending', 'scraping', 'ready', 'failed'));

-- Enable Realtime for scrape_jobs (kept for future use, polling for now)
-- ALTER PUBLICATION supabase_realtime ADD TABLE scrape_jobs;
