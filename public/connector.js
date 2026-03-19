/* global TrelloPowerUp */

// The base URL of your deployed Render service.
// During local dev, set this to http://localhost:3000
const BASE_URL = window.location.origin;

const REVIEW_POPUP_URL = `${BASE_URL}/review-popup.html`;

TrelloPowerUp.initialize(
  {
  // ─── Card Buttons ────────────────────────────────────────────────────────────
  "card-buttons": function (t) {
    return [
      {
        icon: `${BASE_URL}/icon-check.svg`,
        text: "Run Review",
        condition: "edit", // only show to members with edit access
        callback: function (t) {
          return t.popup({
            title: "VetoCheck — Design Review",
            url: REVIEW_POPUP_URL,
            height: 320,
          });
        },
      },
    ];
  },

  // ─── Card Badges ─────────────────────────────────────────────────────────────
  // Reads the last stored review result from card plugin data and shows a badge.
  "card-badges": function (t) {
    return t
      .get("card", "shared", "lastReview")
      .then(function (lastReview) {
        if (!lastReview) return [];

        const score = lastReview.score;
        const verdict = lastReview.verdict;
        const color = verdict === "PASS" ? "green" : "red";

        return [
          {
            text: `DesignCheck: ${score}/10 ${verdict === "PASS" ? "✅" : "❌"}`,
            color: color,
          },
        ];
      })
      .catch(function () {
        return [];
      });
  },

  // ─── Card Detail Badges (expanded view) ──────────────────────────────────────
  "card-detail-badges": function (t) {
    return t
      .get("card", "shared", "lastReview")
      .then(function (lastReview) {
        if (!lastReview) return [];

        return [
          {
            title: "Score",
            text: `${lastReview.score}/10`,
            color: lastReview.verdict === "PASS" ? "green" : "red",
          },
          {
            title: "Verdict",
            text: lastReview.verdict,
            color: lastReview.verdict === "PASS" ? "green" : "red",
          },
          {
            title: "Reviewed",
            text: new Date(lastReview.ts).toLocaleDateString(),
          },
        ];
      })
      .catch(function () {
        return [];
      });
  },
  },
  {
    appKey: "bcaf7c033defa4c9a5eae1bd519cf6dd",
    appName: "VetoCheck",
  }
);
