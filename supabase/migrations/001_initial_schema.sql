-- Santiago: Threads Outlier Analyzer
-- Initial schema based on automation-lab/threads-scraper output format

-- Scraping jobs
CREATE TABLE scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  apify_run_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, scraping, ready, failed
  error_message TEXT,
  post_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Analyzed accounts
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  profile_pic_url TEXT,
  follower_count INTEGER,
  is_verified BOOLEAN DEFAULT false,
  biography TEXT,
  user_id TEXT,                              -- Threads internal user ID
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Posts
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  apify_post_id TEXT UNIQUE NOT NULL,        -- postId from Apify
  post_code TEXT,                            -- short code for URL
  text_content TEXT,
  media_type TEXT DEFAULT 'text',            -- text, image, carousel, video
  like_count INTEGER DEFAULT 0,
  repost_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,
  total_engagement INTEGER GENERATED ALWAYS AS (like_count + repost_count + reply_count) STORED,
  outlier_score REAL,                        -- multiplier (e.g., 5.3x)
  is_reply BOOLEAN DEFAULT false,
  is_repost BOOLEAN DEFAULT false,
  posted_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  raw_data JSONB                             -- full Apify response preserved
);

-- LLM analysis results
CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE UNIQUE,
  hook_analysis TEXT,
  emotion_analysis TEXT,
  structure_analysis TEXT,
  cta_analysis TEXT,
  conversation_analysis TEXT,
  sharing_analysis TEXT,
  hook_type TEXT,                             -- curiosity, number, shock, empathy, prediction, experience
  metadata_analysis JSONB,                   -- media, length, timing analysis
  full_response TEXT,                        -- full LLM response preserved
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Collection items
CREATE TABLE collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pattern analysis cache
CREATE TABLE pattern_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_count INTEGER NOT NULL,               -- collection size at analysis time
  patterns JSONB NOT NULL,                   -- pattern card array
  full_response TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_posts_account_id ON posts(account_id);
CREATE INDEX idx_posts_outlier_score ON posts(outlier_score DESC NULLS LAST);
CREATE INDEX idx_posts_posted_at ON posts(posted_at DESC);
CREATE INDEX idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX idx_scrape_jobs_username ON scrape_jobs(username);

-- Updated_at trigger for scrape_jobs
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scrape_jobs_updated_at
  BEFORE UPDATE ON scrape_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
