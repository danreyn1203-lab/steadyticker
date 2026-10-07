import "server-only";
import { promises as fs } from "fs";
import path from "path";
import researchLogFallback from "@/content/research-log.json";

export interface ResearchedCompany {
  ticker: string;
  name: string;
  sector: string;
  note: string;
  tags?: string[];
  rating?: string;
  articleSlug?: string;
  dateResearched: string;
  owns: boolean;
  ownsNote?: string;
}

export interface LogEntry {
  date: string;
  time?: string;
  type: string;
  ticker?: string;
  title: string;
  summary: string;
}

export interface PortfolioHolding {
  ticker: string;
  name: string;
  note?: string;
}

export interface PortfolioSummary {
  asOf: string;
  totalValue: number;
  holdingsValue: number;
  cash: number;
  gainDollar: number;
  gainPct: number;
  holdings: PortfolioHolding[];
  pending?: PortfolioHolding[];
}

export interface ResearchLog {
  companies: ResearchedCompany[];
  journal: LogEntry[];
  portfolio: PortfolioSummary;
}

const FILE = path.join(process.cwd(), "src", "content", "research-log.json");

export async function getResearchLog(): Promise<ResearchLog | null> {
  // Filesystem first (fresh local edits), static import as the Workers fallback.
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as ResearchLog;
  } catch {
    return (researchLogFallback as ResearchLog) ?? null;
  }
}
