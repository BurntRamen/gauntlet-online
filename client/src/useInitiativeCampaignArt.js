import { useMemo } from "react";
import { applyInitiativeCampaignArt } from "@gauntlet/duel-rules/resolveInitiativeArt";

export function useInitiativeCampaignArt(content) {
  const initiativeArt = useMemo(() => {
    const data = typeof document !== "undefined" && document.getElementById("initiative-campaign-art")?.textContent;
    return data?.[0] === "{" ? JSON.parse(data) : null;
  }, []);
  return useMemo(() => {
    if (!initiativeArt || !content?.campaigns || content.initiativeArtVersion > 2) return content;
    return { ...content, campaigns: applyInitiativeCampaignArt(content.campaigns, initiativeArt), initiativeArtVersion: 2 };
  }, [content, initiativeArt]);
}
