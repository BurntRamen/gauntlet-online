import "./DraftProgress.css";

export default function DraftProgress({ message, value, max }) {
  return <div className="draft-progress" role="status" aria-live="polite">
    <span>{message}</span>
    <progress aria-label={message} value={value} max={max || 1} />
  </div>;
}
