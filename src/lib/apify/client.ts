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
 * Returns the Apify run object (contains id, defaultDatasetId, etc.).
 */
export async function startApifyRun(
  username: string,
  webhookUrl: string
): Promise<{ id: string }> {
  const run = await getClient()
    .actor(APIFY_ACTOR_ID)
    .start(
      {
        mode: "posts",
        usernames: [username],
        maxPosts: MAX_POSTS_PER_USER,
        includeProfile: true,
      },
      {
        waitForFinish: 0,
        webhooks: [
          {
            eventTypes: [
              "ACTOR.RUN.SUCCEEDED",
              "ACTOR.RUN.FAILED",
              "ACTOR.RUN.ABORTED",
              "ACTOR.RUN.TIMED_OUT",
            ],
            requestUrl: webhookUrl,
          },
        ],
      }
    );

  return { id: run.id };
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
