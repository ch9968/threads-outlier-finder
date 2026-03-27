import { VertexAI, type GenerativeModel } from "@google-cloud/vertexai";

let _vertexAI: VertexAI | null = null;

function getVertexAI(): VertexAI {
  if (_vertexAI) return _vertexAI;

  const project = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION || "us-central1";

  if (!project) {
    throw new Error("Missing GCP_PROJECT_ID environment variable");
  }

  // For Vercel: parse service account key from env var
  const keyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;

  if (keyJson) {
    let credentials;
    try {
      credentials = JSON.parse(keyJson);
    } catch {
      throw new Error("GCP_SERVICE_ACCOUNT_KEY is not valid JSON");
    }
    _vertexAI = new VertexAI({
      project,
      location,
      googleAuthOptions: { credentials },
    });
  } else {
    // Local dev: uses GOOGLE_APPLICATION_CREDENTIALS or ADC
    _vertexAI = new VertexAI({ project, location });
  }

  return _vertexAI;
}

const DEFAULT_MODEL = "gemini-2.5-pro-preview-05-06";

export function getGenerativeModel(modelName?: string): GenerativeModel {
  const vertexAI = getVertexAI();
  return vertexAI.getGenerativeModel({
    model: modelName || process.env.VERTEX_AI_MODEL || DEFAULT_MODEL,
  });
}
