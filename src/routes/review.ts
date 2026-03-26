import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import {
  getCard,
  getAttachments,
  filterImageAttachments,
  downloadAttachmentAsBase64,
  postComment,
} from "../lib/trello";
import { reviewDesign } from "../lib/openai";
import { formatReviewComment } from "../lib/formatter";

const router = Router();

// 10 reviews per hour per IP (proxy-aware: trust X-Forwarded-For set by Render)
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. Maximum 10 reviews per hour." },
  keyGenerator: (req) => {
    // Key by board ID when available so the limit is per-board, not per-IP
    const body = req.body as { boardId?: string };
    return body?.boardId ?? (req.ip ?? "unknown");
  },
});

interface ReviewRequest {
  cardId: string;
  token: string;
  attachmentId?: string;
}

router.post(
  "/",
  reviewLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const { cardId, token: userToken, attachmentId } = req.body as ReviewRequest;
    const token = userToken || process.env.TRELLO_TOKEN;

    if (!cardId || typeof cardId !== "string") {
      res.status(400).json({ error: "cardId is required" });
      return;
    }
    if (!token) {
      res.status(401).json({ error: "No Trello token available. Set TRELLO_TOKEN env var." });
      return;
    }

    try {
      // 1. Fetch card
      const card = await getCard(cardId, token);

      // 2. Validate brief
      if (!card.desc || card.desc.trim().length < 10) {
        res.status(422).json({
          error:
            "Card description (design brief) is missing or too short. Add a brief to the card description before running a review.",
        });
        return;
      }

      // 3. Fetch attachments
      const allAttachments = await getAttachments(cardId, token);
      const imageAttachments = filterImageAttachments(allAttachments);

      if (imageAttachments.length === 0) {
        res.status(422).json({
          error:
            "No image attachments found on this card. Upload a thumbnail image before running a review.",
        });
        return;
      }

      // 4. Pick requested or latest image
      const latest = attachmentId
        ? (imageAttachments.find((a) => a.id === attachmentId) ?? imageAttachments[0])
        : imageAttachments[0];
      const { base64, mimeType } = await downloadAttachmentAsBase64(latest, token);

      // 5. GPT-4o Vision review
      const reviewResult = await reviewDesign(card.desc.trim(), base64, mimeType);

      // 6. Format comment
      const commentText = formatReviewComment(reviewResult);

      // 7. Post comment to card
      const { id: commentId } = await postComment(cardId, token, commentText);

      // 8. Return summary
      res.json({
        success: true,
        score: reviewResult.overall_score,
        verdict: reviewResult.verdict,
        commentId,
        imageName: latest.name,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[review] Error:", message);

      if (
        message.includes("Rate limit") ||
        message.includes("429") ||
        message.includes("quota")
      ) {
        res.status(429).json({ error: "OpenAI rate limit reached. Try again shortly." });
        return;
      }

      if (message.includes("Trello") && message.includes("401")) {
        res.status(401).json({ error: "Trello token is invalid or expired. Re-authorise the Power-Up." });
        return;
      }

      res.status(500).json({ error: message });
    }
  }
);

export default router;
