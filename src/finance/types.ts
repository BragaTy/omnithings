export interface Transaction {
  /** Stable id used to skip duplicates when the same statement is imported twice */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  /** Negative = money out, positive = money in */
  amount: number;
  category: string;
  /** File it came from */
  source: string;
  /** Category chosen by hand (never overwritten by rules) */
  manual?: boolean;
}

export interface RawTransaction {
  date: string;
  description: string;
  amount: number;
  fitid?: string;
}

export interface ParsedStatement {
  source: string;
  rows: RawTransaction[];
  /** Most amounts positive and no balance column: probably a credit card bill */
  looksLikeCardBill: boolean;
}

export interface FinanceData {
  transactions: Transaction[];
  /** merchantKey -> category, learned from manual changes */
  rules: Record<string, string>;
  /** category -> monthly limit in BRL */
  budgets: Record<string, number>;
}
