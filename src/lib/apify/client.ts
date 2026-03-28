import { ApifyClient } from "apify-client";
import { APIFY_ACTOR_ID, MAX_POSTS_PER_USER } from "./schema";

let _client: ApifyClient | null = null;

function getClient(): ApifyClient {
  if (_client) return _client;

  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) {
    throw new Error("Missing APIFY_API_TOKEN environment variable");
  }

  _client = new ApifyClient({ token: apifyToken });
  return _client;
}

/**
 * Start a scraping run for a Threads username.
 * Uses polling instead of webhooks (webhooks require a public URL).
 */
export async function startApifyRun(
  username: string
): Promise<{ id: string; datasetId: string }> {
  const run = await getClient()
    .actor(APIFY_ACTOR_ID)
    .start(
      {
        mode: "user",
        usernames: [username],
        max_posts: MAX_POSTS_PER_USER,
      },
      {
        waitForFinish: 0,
        maxItems: MAX_POSTS_PER_USER,
      }
    );

  return { id: run.id, datasetId: run.defaultDatasetId };
}

/**
 * Get the status of an Apify run.
 */
export async function getApifyRunStatus(
  runId: string
): Promise<{ status: string; datasetId: string }> {
  const run = await getClient().run(runId).get();
  if (!run) {
    throw new Error(`Apify run ${runId} not found`);
  }
  return { status: run.status, datasetId: run.defaultDatasetId };
}

/**
 * Fetch all items from an Apify dataset.
 */
export async function fetchDatasetItems(
  datasetId: string
): Promise<unknown[]> {
  const dataset = getClient().dataset(datasetId);
  const { items } = await dataset.listItems();
  return items;
}
