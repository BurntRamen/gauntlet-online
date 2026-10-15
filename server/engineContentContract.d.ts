/** Runtime-validated authored contract. Executable handlers remain deployed code. */
import { CardEffect, FactionMechanics, EncounterSetup, GameConfig, ContentBinding, CardPresentation as PublishedCardPresentation } from "../shared/duel-rules/contentContracts";
export interface CardPresentation {
  readonly id: string;
  readonly gameplayCardId: string;
  readonly factionId: string;
  readonly name: string;
  readonly text: string;
  readonly value: number;
  readonly type: string;
  readonly rarity: string;
  readonly defaultVariantId: string;
  readonly effect: CardEffect;
  readonly origin?: "admin-v1";
  readonly status?: "active" | "archived";
  readonly availability?: Readonly<Record<"library" | "constructed" | "encounters" | "earnedPacks" | "draft" | "sealed", boolean>>;
  readonly presentation: PublishedCardPresentation;
}
export interface FactionPresentation {
  readonly id: string;
  readonly name: string;
  readonly cardImage: string;
  readonly campaignOnly?: boolean;
  readonly mechanics: FactionMechanics | null;
  readonly commander: CharacterPresentation;
  readonly general: CharacterPresentation;
  readonly city: CharacterPresentation;
}
export interface CharacterPresentation {
  readonly name: string;
  readonly image: string;
  /** Rules wording is protected for faction powers. */
  readonly text: string;
}
export interface ChapterPresentation {
  readonly opponentDeckId?: string;
  readonly setup: EncounterSetup;
  readonly id: string;
  readonly title: string;
  readonly story: string;
  readonly playableName: string;
  readonly opponentName: string;
  readonly image: string;
  readonly beforeBattle: string;
  readonly afterBattle: string;
  readonly dialogue: readonly string[];
  readonly endDialogue: readonly string[];
  readonly dialogueAudio: readonly (string | null)[];
  readonly endDialogueAudio: readonly (string | null)[];
  readonly deckTemplate: { readonly id: string; readonly name: string; readonly description: string };
}
export interface EngineContentRelease {
  readonly contractVersion: "gauntlet.engine-content.v2";
  readonly releaseId: string;
  readonly factions: Readonly<Record<string, FactionPresentation>>;
  readonly manifest: {
    readonly deckTemplates: readonly (AuthoredDeck | { readonly id: string; readonly name: string; readonly description: string; readonly legacy: true })[];
    readonly deckOffers: readonly DeckOffer[];
    readonly schemaVersion: 2;
    readonly contentBinding: ContentBinding;
    readonly gameConfig: GameConfig;
    readonly trainingOpponent: { readonly name: string; readonly opponentKind: "training-ai" };
    readonly contentVersion: string;
    readonly presentationAssets: Readonly<Record<string, string>>;
    readonly rulesVersion: string;
    readonly factions: readonly FactionPresentation[];
    readonly cards: readonly CardPresentation[];
    readonly draftSets: readonly { readonly id: string; readonly name: string; readonly number: number; readonly factionIds: readonly string[]; readonly authored?: true; readonly memberCardIds?: readonly string[]; readonly draftAvailable: boolean; readonly sealedAvailable: boolean; readonly unavailableReason?: string }[];
    readonly campaigns: Readonly<Record<string, {
      readonly factionName: string;
      readonly commanderName: string;
      readonly pitch: string;
      readonly coverImage: string | null;
      readonly chapters: readonly ChapterPresentation[];
      readonly characters: Readonly<Record<string, string | { readonly name: string; readonly role: string; readonly description: string }>>;
    }>>;
    readonly collectorVariants: readonly { readonly variantId: string; readonly gameplayCardId: string; readonly art: string; readonly paid: boolean; readonly origin?: "admin-printing-v1"; readonly name: string; readonly edition: string; readonly collectorNumber?: string; readonly position?: number; readonly finish: "standard" | "foil"; readonly entitlementRequired?: true; readonly acquisition: string; readonly status?: "active" | "archived"; readonly presentation: PublishedCardPresentation }[];
    readonly modeMetadata: Readonly<Record<string, { readonly name: string; readonly description: string; readonly heroTitle?: string; readonly heroEyebrow?: string; readonly heroDescription?: string; readonly menuDetail?: string }>>;
  };
}

export interface DeckComposition { readonly factionId: string; readonly generalId: string | null; readonly cards: readonly { readonly cardId: string; readonly printingId: string }[]; }
export interface AuthoredDeck { readonly id: string; readonly revision: string; readonly name: string; readonly description: string; readonly strategy: string; readonly composition: DeckComposition; readonly destinations: { readonly player: boolean; readonly practice: boolean; readonly encounter: boolean }; readonly status: "active" | "archived"; }
export interface DeckOffer { readonly id: string; readonly revision: string; readonly releaseId: string; readonly name: string; readonly description: string; readonly templateId: string; readonly template: AuthoredDeck; readonly deckBoxId: string; readonly cardBackId: string; readonly cardBack: string; readonly prices: { readonly gold: number | null; readonly timetwisters: number | null }; readonly status: "available" | "unavailable" | "archived"; readonly terms: { readonly printingIds: readonly string[]; readonly gameplayAccess: string; readonly savedDeck: string; readonly duplicates: string; readonly deckBoxAccess: string }; }
