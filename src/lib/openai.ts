import OpenAI from "openai";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompts";

export interface CategoryResult {
  score: number;
  weight: number;
  feedback: string;
  issues: string[];
}

export interface ReviewResult {
  categories: {
    brief_compliance: CategoryResult;
    composition: CategoryResult;
    brand_consistency: CategoryResult;
    click_worthiness: CategoryResult;
  };
  overall_score: number;
  verdict: "PASS" | "FAIL";
  summary: string;
  top_revisions: [string, string, string];
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function reviewDesign(
  brief: string,
  imageBase64: string,
  mimeType: string
): Promise<ReviewResult> {
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1500,
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: buildUserMessage(brief, imageBase64, mimeType),
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty response from GPT-4o");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`GPT-4o returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  return validateReviewResult(parsed);
}

function validateReviewResult(data: unknown): ReviewResult {
  if (typeof data !== "object" || data === null) {
    throw new Error("Review result is not an object");
  }

  const d = data as Record<string, unknown>;

  if (typeof d.overall_score !== "number") {
    throw new Error("Missing or invalid overall_score");
  }
  if (d.verdict !== "PASS" && d.verdict !== "FAIL") {
    throw new Error("Missing or invalid verdict");
  }
  if (typeof d.summary !== "string") {
    throw new Error("Missing or invalid summary");
  }
  if (
    !Array.isArray(d.top_revisions) ||
    d.top_revisions.length !== 3 ||
    !d.top_revisions.every((r) => typeof r === "string")
  ) {
    throw new Error("top_revisions must be an array of exactly 3 strings");
  }

  const categories = d.categories as Record<string, unknown>;
  const requiredCategories = [
    "brief_compliance",
    "composition",
    "brand_consistency",
    "click_worthiness",
  ];
  for (const cat of requiredCategories) {
    if (typeof categories?.[cat] !== "object" || categories[cat] === null) {
      throw new Error(`Missing category: ${cat}`);
    }
  }

  return data as ReviewResult;
}
