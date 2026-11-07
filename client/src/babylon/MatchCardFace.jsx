import { presentationArt, usePresentationArt } from "../brand/presentationArt";
import { useEffect, useRef } from "react";
import { getCardForPresentation } from "../cardArt";
import { COMPOSED_CARD_SIZE, paintPublishedCardFace } from "./composedCardFace";

export default function MatchCardFace({ card, alt = "", fallbackClassName = "" }) {
  usePresentationArt();
  const canvasRef = useRef(null);
  const publishedCard = getCardForPresentation(card.raw || card, card.factionId || card.raw?.factionId);
  const composed = Boolean(publishedCard.presentation?.composed);
  const artPath = presentationArt((composed ? publishedCard.presentation?.illustration : card.artPath) || card.artPath, { factionId: publishedCard.factionId || card.factionId, surface: composed ? "illustration" : "card", cardId: publishedCard.gameplayCardId || publishedCard.definitionId || publishedCard.id });

  useEffect(() => {
    if (!composed) return undefined;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return undefined;
    paintPublishedCardFace(context, publishedCard, null);
    if (!artPath) return undefined;
    const illustration = new Image();
    illustration.crossOrigin = "anonymous";
    illustration.onload = () => paintPublishedCardFace(context, publishedCard, illustration);
    illustration.src = artPath;
    return () => { illustration.onload = null; };
  }, [composed, publishedCard, artPath]);

  if (composed) {
    return <canvas ref={canvasRef} className="production-composed-card-face"
      width={COMPOSED_CARD_SIZE.width} height={COMPOSED_CARD_SIZE.height}
      role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}
      data-art-source={artPath || ""} />;
  }
  return artPath ? <img src={artPath} alt={alt} /> : <span className={fallbackClassName}>{card.label || "Card"}</span>;
}
