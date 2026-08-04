const ICONS = {
  attack: (
    <>
      <path d="M6 18 18 6" />
      <path d="m13 5 6-1-1 6" />
      <path d="m4 15 5 5" />
    </>
  ),
  block: (
    <>
      <path d="M12 3 19 6v5c0 4.4-2.7 7.7-7 10-4.3-2.3-7-5.6-7-10V6l7-3Z" />
      <path d="M9 12h6" />
    </>
  ),
  payment: (
    <>
      <ellipse cx="9" cy="8" rx="5" ry="2.5" />
      <path d="M4 8v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V8" />
      <path d="M8 15v1c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4c0-1.1-1.2-2-3-2.3" />
    </>
  ),
  priority: (
    <>
      <path d="m12 3 2.2 5.3L20 9l-4.3 3.7L17 18l-5-2.8L7 18l1.3-5.3L4 9l5.8-.7L12 3Z" />
    </>
  ),
  placement: (
    <>
      <path d="M5 4h14v16H5z" />
      <path d="m12 7 3 4h-2v5h-2v-5H9l3-4Z" />
    </>
  ),
  damage: (
    <>
      <path d="m13 2-2 7 5-2-4 8 7-3-8 10 1-7-6 2 4-8-5 2 8-9Z" />
    </>
  ),
  pass: (
    <>
      <path d="M5 12h12" />
      <path d="m13 7 5 5-5 5" />
    </>
  ),
  cancel: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  inspect: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </>
  )
};

export default function GameIcon({ name, label = "", size = 18, className = "" }) {
  return (
    <svg
      className={`gauntlet-game-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label || undefined}
    >
      {ICONS[name] || ICONS.priority}
    </svg>
  );
}
