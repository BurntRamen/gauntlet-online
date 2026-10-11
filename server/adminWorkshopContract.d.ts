import { ContentBinding, CardEffectId, FactionMechanicId } from "../shared/duel-rules/contentContracts";

export type WorkshopSource = "live" | "draft";
export type AuthoredDomain = "campaigns" | "encounters" | "factions" | "cards" | "decks" | "characters" | "assets" | "game";
export interface WorkshopSubject { readonly domain: AuthoredDomain | "card-effects" | "faction-effects"; readonly id: string; }
export interface WorkshopIdentity {
  readonly source: WorkshopSource; readonly hash: string; readonly releaseId: string; readonly revision: number | null;
}
export interface ParameterRule { readonly min: number; readonly max: number; readonly default: number; readonly label: string; }
export interface CardEffectGuidance {
  readonly id: CardEffectId; readonly version: 1; readonly legacyCardId: string;
  readonly factionId: string; readonly cardType: string; readonly label: string; readonly description: string;
  readonly descriptionSource: "deployed-source"; readonly parameters: Readonly<Record<string, ParameterRule>>;
}
export interface FactionEffectGuidance extends Omit<CardEffectGuidance, "id" | "legacyCardId" | "cardType"> { readonly id: FactionMechanicId; }
export interface WorkshopMetadata extends WorkshopIdentity {
  readonly version: 1; readonly cardEffects: readonly CardEffectGuidance[]; readonly factionEffects: readonly FactionEffectGuidance[];
  readonly bossAbilities: readonly { readonly id: string; readonly label: string }[];
  readonly encounterRules: Readonly<Record<string, { readonly min: number; readonly max: number; readonly help: string }>>;
  readonly gameConfig: { readonly handSize: number; readonly handSizeBounds: readonly [3, 12]; readonly startingLife: 42; readonly deckSize: 52; readonly laneCount: 3; readonly suits: readonly string[]; readonly values: readonly number[] };
  readonly bindings: ContentBinding;
  readonly capabilities: { readonly liveTests: true; readonly customScenarios: 1; readonly commandPreview: true; readonly livePresentation: true; readonly relationships: true; readonly releaseReview: true };
}
export interface RelationshipNode { readonly key: string; readonly domain: AuthoredDomain | "card-effects" | "faction-effects" | "encounter-mechanics" | "asset-library"; readonly id: string; readonly label: string; readonly missing?: true; }
export interface RelationshipEdge { readonly from: string; readonly to: string; readonly kind: string; readonly status?: "added" | "removed" | "unchanged"; }
export interface ContentRelationships { readonly source: WorkshopSource; readonly hash: string; readonly liveHash?: string; readonly nodes: readonly RelationshipNode[]; readonly edges: readonly RelationshipEdge[]; readonly coverage: string; }
export interface ReleaseChange { readonly domain: AuthoredDomain; readonly id: string; readonly label: string; readonly field: string; readonly path: string; readonly fieldLabel: string; readonly live: unknown; readonly draft: unknown; readonly before: unknown; readonly after: unknown; readonly mechanical: boolean; }
export interface ReleaseReview {
  readonly version: 1; readonly revision: number; readonly hash: string | null;
  readonly groups: readonly { readonly id: string; readonly label: string; readonly category: string; readonly changes: readonly ReleaseChange[] }[];
  readonly readiness: { readonly saved: boolean; readonly validated: boolean; readonly previewed: boolean; readonly engineTestRequired: boolean; readonly engineTested: boolean; readonly ready: boolean; readonly phase: string; readonly engineTestLabel: string; readonly writable: boolean; readonly connectionRequired: boolean };
  readonly comparison?: { readonly releaseId: string; readonly label: string; readonly compatible: boolean; readonly activeReleaseId: string; readonly canRollback: boolean };
}

export type TestSubject = { readonly kind: "encounter" | "card" | "faction" | "game-config"; readonly id: string } | { readonly kind: "card-effect"; readonly id: CardEffectId; readonly cardId: string };
export interface ScenarioSlot { readonly value: number; readonly suit: "spades" | "hearts" | "diamonds" | "clubs"; readonly cardId?: string; }
export interface ScenarioPlayer { readonly factionId: string; readonly life: number; readonly hand: readonly ScenarioSlot[]; readonly deck: readonly ScenarioSlot[]; readonly discard: readonly ScenarioSlot[]; readonly combat: readonly [ScenarioSlot|null, ScenarioSlot|null, ScenarioSlot|null]; readonly support: readonly [ScenarioSlot|null, ScenarioSlot|null, ScenarioSlot|null]; readonly accelerationCounters: number; readonly revenants: number; readonly attacksDeclaredThisTurn: number; readonly blocksDeclaredThisTurn: number; readonly previousPlayedValue: number|null; readonly previousAttackSuit: ScenarioSlot["suit"]|null; }
export interface TestScenario { readonly version: 1; readonly turn: number; readonly priority: 1|2; readonly players: {readonly 1: ScenarioPlayer; readonly 2: ScenarioPlayer}; }
export interface TestStart { readonly source?: WorkshopSource; readonly subject?: TestSubject; readonly expectedRevision?: number; readonly factionId?: string; readonly encounterId?: string; readonly scenario?: TestScenario; }
export interface TestIdentity { readonly source: WorkshopSource; readonly subject: TestSubject & {readonly label: string}; readonly contentHash: string; readonly draftHash: string|null; readonly draftRevision: number|null; readonly releaseId: string; readonly binding: ContentBinding; readonly scenario: TestScenario|null; readonly scenarioHash: string|null; readonly expiresAt: string; }
