import { useMemo } from "react";
import { applyInitiativeCampaignArt } from "@gauntlet/duel-rules/resolveInitiativeArt";
import initiativeArt from "../public/assets/gauntlet/campaigns/initiative-art-v2.json";

export function useInitiativeCampaignArt(content) {
  return useMemo(() => {
    if (!content?.campaigns || content.initiativeArtVersion > 2) return content;
    return { ...content, campaigns: applyInitiativeCampaignArt(content.campaigns, initiativeArt), initiativeArtVersion: 2 };
  }, [content]);
}
