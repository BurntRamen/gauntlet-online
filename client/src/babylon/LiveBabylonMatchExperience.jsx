import { useEffect, useRef } from "react";
import ProductionMatchExperience from "./ProductionMatchExperience";
import { createLiveSocketAdapter } from "./matchAdapters";

export default function LiveBabylonMatchExperience({
  session,
  options,
  completion,
  campaignContinuationReady,
  onContinueCampaign,
  onOpenReplay,
  onRendererFailure,
  onLeaveMatch
}) {
  const adapterRef = useRef(null);
  if (!adapterRef.current) {
    adapterRef.current = createLiveSocketAdapter({
      session,
      onLeaveMatch
    });
  }

  useEffect(() => () => adapterRef.current?.dispose(), []);

  return (
    <ProductionMatchExperience
      adapter={adapterRef.current}
      options={options}
      completion={completion}
      campaignContinuationReady={campaignContinuationReady}
      onContinueCampaign={onContinueCampaign}
      onOpenReplay={onOpenReplay}
      onRendererFailure={onRendererFailure}
    />
  );
}
