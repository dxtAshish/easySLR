import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, STATUS_TONE, type ArticleStatusValue } from "@/components/articles/article-status";

export function ArticleStatusBadge({ status }: { status: ArticleStatusValue }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
