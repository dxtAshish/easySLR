export interface ValidatedArticleData {
  pmid?: string;
  title: string;
  authors?: string;
  citation?: string;
  firstAuthor?: string;
  journal?: string;
  pubYear?: number;
  createDate?: Date;
  pmcid?: string;
  nihmsId?: string;
  doi?: string;
}

export type RowOutcomeStatus = "valid" | "duplicate" | "invalid";

export interface ImportRowResult {
  rowNumber: number;
  status: RowOutcomeStatus;
  data?: ValidatedArticleData;
  warnings: string[];
  reason?: string;
  raw: Record<string, unknown>;
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
}
