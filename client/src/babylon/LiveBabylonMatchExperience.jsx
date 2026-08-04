import { useEffect, useRef } from "react";
import ProductionMatchExperience from "./ProductionMatchExperience";
import { createLiveSocketAdapter } from "./matchAdapters";

export default function LiveBabylonMatchExperience({
  session,
  options,
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
      onRendererFailure={onRendererFailure}
    />
  );
}
