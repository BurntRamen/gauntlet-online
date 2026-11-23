import { useEffect } from "react";
import { applyInitiativeCampaignArt } from "@gauntlet/duel-rules/resolveInitiativeArt";

let artRequest;
function loadCampaignArt() {
  if (!artRequest) {
    artRequest = fetch((process.env.PUBLIC_URL || "") + "/assets/gauntlet/campaigns/initiative-art-v1.json")
      .then(response => {
        if (!response.ok) throw new Error("Campaign illustration catalog unavailable");
        return response.json();
      })
      .catch(error => { artRequest = undefined; throw error; });
  }
  return artRequest;
}

export function useInitiativeCampaignArt(open, content, setContent) {
  useEffect(() => {
    if (!open || !content?.campaigns || content.initiativeArtVersion >= 1) return;
    let active = true;
    loadCampaignArt().then(art => {
      if (active) setContent(current => current === content
        ? { ...current, campaigns: applyInitiativeCampaignArt(current.campaigns, art), initiativeArtVersion: 1 }
        : current);
    }).catch(() => { /* Keep the published campaign playable and retry on the next visit. */ });
    return () => { active = false; };
  }, [open, content, setContent]);
}
