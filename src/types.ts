export type Capability = "yes" | "conditional" | "no" | "lack-of-data";
export type Recommendation = "recommended" | "acceptable" | "avoid" | "lack-of-data";
export type Layout = "us" | "swedish" | "german" | "uk";
export type Intent = "general" | "undo" | "save" | "search" | "list" | "new-record";

export interface Environment { browser: string; os: string; layout: Layout; }
export interface Shortcut { id: string; display: string; modifiers: string[]; key: string; }
export interface DatasetRecord {
  shortcut: string;
  intent: Intent;
  capability: Capability;
  recommendation: Recommendation;
  browsers: string[];
  operatingSystems: string[];
  layouts: string[];
  evidence: "observed" | "expected" | "none";
  note: string;
}
export interface Dataset {
  schemaVersion: string;
  generatedAt: string;
  minimumContributionSize: number;
  records: DatasetRecord[];
}
