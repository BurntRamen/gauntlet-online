import { collectorPresentation } from "./collectorPresentation";
import "./CollectorCardPresentation.css";

export default function CollectorCardPresentation({ card, presentation, children, className = "", alwaysWrap = false }) {
  const { animated, style, palette } = collectorPresentation(card, presentation);
  if (!animated && !alwaysWrap) return children;
  return <div className={`special-card-presentation ${className}${animated ? " is-animated-collector" : ""}`}
    style={animated ? { "--collector-a": palette[0], "--collector-b": palette[1], "--collector-c": palette[2] } : undefined}
    data-collector-style={animated ? style : undefined}>
    {children}
    {animated && <i className="collector-card-sheen" aria-hidden="true" />}
  </div>;
}
