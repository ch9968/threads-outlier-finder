/**
 * Outlier score calculation.
 *
 * Formula (ViewStats-style):
 *   baseline = avg(total_engagement of latest 10 original posts)
 *   outlier_score = post.total_engagement / baseline
 *
 * Filtering:
 *   - Exclude is_reply=true and is_repost=true from baseline AND scoring
 *   - These posts get outlier_score = null
 *
 * Edge cases:
 *   - < 11 original posts: use all original posts for baseline
 *   - baseline == 0: all scores = 0
 *   - 0 original posts: return empty (no scores assigned)
 */

interface PostForScoring {
  id: string;
  totalEngagement: number;
  isReply: boolean;
  isRepost: boolean;
  postedAt: Date;
}

interface ScoredPost {
  id: string;
  outlierScore: number | null;
}

const BASELINE_COUNT = 10;

export function calculateOutlierScores(posts: PostForScoring[]): ScoredPost[] {
  // Separate original posts from replies/reposts
  const originalPosts = posts.filter((p) => !p.isReply && !p.isRepost);

  // Sort by postedAt descending (newest first) for baseline
  const sorted = [...originalPosts].sort(
    (a, b) => b.postedAt.getTime() - a.postedAt.getTime()
  );

  // Calculate baseline from latest N original posts
  const baselinePosts = sorted.slice(0, BASELINE_COUNT);

  if (baselinePosts.length === 0) {
    // No original posts — all get null score
    return posts.map((p) => ({ id: p.id, outlierScore: null }));
  }

  const totalEngagement = baselinePosts.reduce(
    (sum, p) => sum + p.totalEngagement,
    0
  );
  const baseline = totalEngagement / baselinePosts.length;

  return posts.map((p) => {
    // Replies and reposts get null score
    if (p.isReply || p.isRepost) {
      return { id: p.id, outlierScore: null };
    }

    // Zero baseline = zero score
    if (baseline === 0) {
      return { id: p.id, outlierScore: 0 };
    }

    const score = Math.round((p.totalEngagement / baseline) * 100) / 100;
    return { id: p.id, outlierScore: score };
  });
}

/**
 * Check if the baseline was calculated with fewer posts than ideal.
 * Returns true if < 11 original posts (using full average instead of latest 10).
 */
export function isSmallSampleBaseline(posts: PostForScoring[]): boolean {
  const originalCount = posts.filter((p) => !p.isReply && !p.isRepost).length;
  return originalCount > 0 && originalCount < BASELINE_COUNT + 1;
}
