export const ARTICLE_STATUSES = ["UNSCREENED", "INCLUDED", "EXCLUDED", "MAYBE"] as const;
export type ArticleStatusValue = (typeof ARTICLE_STATUSES)[number];

export const STATUS_LABEL: Record<ArticleStatusValue, string> = {
  UNSCREENED: "Unscreened",
  INCLUDED: "Included",
  EXCLUDED: "Excluded",
  MAYBE: "Maybe",
};

export const STATUS_TONE: Record<ArticleStatusValue, "neutral" | "green" | "red" | "amber"> = {
  UNSCREENED: "neutral",
  INCLUDED: "green",
  EXCLUDED: "red",
  MAYBE: "amber",
};
