/** Published configuration only. Player state must never be written to these types. */
export type ParaFormat = "faction-constructed" | "classic";
export type ProposalState = "draft" | "archived";
export type ProductCategory = "profile-music" | "faction-soundtrack" | "digital-publication" |
  "collector-treatment" | "card-back" | "deck-box" | "profile-title" | "faction-banner" | "analytics" | "variant-lab" | "digital-edition" | "bundle";
interface Definition { id: string; name: string; description: string; }
interface Window { startsAt: string | null; endsAt: string | null; }
export interface ParaSeason extends Definition, Window {
  status: ProposalState | "active"; formats: ParaFormat[]; publicRulesVersion: string;
  countedResults: number; qualifyingEventCount: number; invitationalThreshold: number;
  championshipThreshold: number; perfectQualifierQualifies: boolean; perfectInvitationalQualifies: boolean;
  tiebreak: "prestige-perfect-wins-earliest-account" | "prestige-wins-perfect-earliest-account";
  goldBudget: number;
}
export interface ParaEvent extends Definition, Window {
  seasonId: string; status: ProposalState | "scheduled"; eventType: "qualifier" | "invitational" | "championship";
  format: ParaFormat; week: number; registrationOpensAt: string | null; registrationClosesAt: string | null;
  winTarget: 5 | 7 | 12; lossLimit: 2 | 3; scoringAttempts: number; prestige: number[];
  rewards: { wins: number; entitlementId: string }[]; finalizationPolicy: "completed-run-only";
}
export interface GoldAward extends Definition, Window {
  seasonId: string; status: ProposalState | "active";
  condition: "welcome" | "basic-training" | "faction-training" | "campaign" | "draft-learning" | "ordinary-play";
  minimumOccurrences: number; amount: number; claimLimit: number;
}
export interface Entitlement extends Definition {
  category: ProductCategory; provenance: "earned-only" | "commercial";
  duration: "permanent" | "days" | "season"; durationDays: number; seasonId: string;
  asset: string; rightsReference: string; fulfillment: "unavailable" | "available";
}
export interface Product extends Definition, Window {
  category: ProductCategory; status: "unavailable" | "active" | "archived"; artwork: string;
  entitlements: string[]; pricing: "gold" | "gems" | "dual" | "split" | "free" | "unavailable";
  goldPrice: number; gemPrice: number; purchaseLimit: number;
}
export interface ParaConfiguration {
  schemaVersion: "gauntlet.para-league.v1"; seasons: ParaSeason[]; events: ParaEvent[];
  awards: GoldAward[]; products: Product[]; entitlements: Entitlement[];
}
