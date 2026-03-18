import type { ReviewResult } from "./openai";

function scoreBar(score: number): string {
  const filled = Math.round(score);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function issuesList(issues: string[]): string {
  if (!issues || issues.length === 0) return "";
  return `\n⚠️ *Issues:* ${issues.map((i) => `\`${i}\``).join(" · ")}`;
}

export function formatReviewComment(result: ReviewResult): string {
  const { categories, overall_score, verdict, summary, top_revisions } = result;
  const verdictEmoji = verdict === "PASS" ? "✅" : "❌";
  const scoreFormatted = overall_score.toFixed(1);

  const lines: string[] = [
    `⭐ **DesignCheck Review — ${scoreFormatted}/10 — ${verdict} ${verdictEmoji}**`,
    `\`${scoreBar(overall_score)}\``,
    ``,
    `> ${summary}`,
    ``,
    `---`,
    ``,
    `📋 **Brief Compliance (${categories.brief_compliance.score}/10)**`,
    categories.brief_compliance.feedback,
    issuesList(categories.brief_compliance.issues),
    ``,
    `🎨 **Composition (${categories.composition.score}/10)**`,
    categories.composition.feedback,
    issuesList(categories.composition.issues),
    ``,
    `🏷️ **Brand Consistency (${categories.brand_consistency.score}/10)**`,
    categories.brand_consistency.feedback,
    issuesList(categories.brand_consistency.issues),
    ``,
    `🚀 **Click-Worthiness (${categories.click_worthiness.score}/10)**`,
    categories.click_worthiness.feedback,
    issuesList(categories.click_worthiness.issues),
    ``,
    `---`,
    ``,
    `🔧 **Top Revisions:**`,
    ...top_revisions.map((r, i) => `${i + 1}. ${r}`),
    ``,
    `---`,
    `*Reviewed by VetoCheck · Powered by GPT-4o Vision*`,
  ];

  return lines.filter((l) => l !== undefined).join("\n");
}
