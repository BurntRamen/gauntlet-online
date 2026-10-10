import { useEffect, useRef } from "react";
import { COMPOSED_CARD_SIZE, paintPublishedCardFace } from "./composedCardFace";

export default function MatchCardFace({ card, alt = "", fallbackClassName = "" }) {
  const canvasRef = useRef(null);
  const publishedCard = card.raw || card;
  const composed = Boolean(publishedCard.presentation?.composed);
  const artPath = card.artPath || publishedCard.presentation?.illustration;

  useEffect(() => {
    if (!composed) return undefined;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return undefined;
    paintPublishedCardFace(context, publishedCard, null);
    if (!artPath) return undefined;
    const illustration = new Image();
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
