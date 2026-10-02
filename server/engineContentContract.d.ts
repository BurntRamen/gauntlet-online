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
    readonly schemaVersion: 2;
    readonly contentBinding: ContentBinding;
    readonly gameConfig: GameConfig;
    readonly trainingOpponent: { readonly name: string; readonly opponentKind: "training-ai" };
    readonly contentVersion: string;
    readonly rulesVersion: string;
    readonly factions: readonly FactionPresentation[];
    readonly cards: readonly CardPresentation[];
    readonly campaigns: Readonly<Record<string, {
      readonly factionName: string;
      readonly commanderName: string;
      readonly pitch: string;
      readonly coverImage: string | null;
      readonly chapters: readonly ChapterPresentation[];
      readonly characters: Readonly<Record<string, string | { readonly name: string; readonly role: string; readonly description: string }>>;
    }>>;
    readonly collectorVariants: readonly { readonly variantId: string; readonly gameplayCardId: string; readonly art: string; readonly paid: boolean }[];
    readonly modeMetadata: Readonly<Record<string, { readonly name: string; readonly description: string }>>;
  };
}
