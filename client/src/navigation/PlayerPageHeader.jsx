import "./PlayerPageHeader.css";

// Shared by the real player page and the authoring preview. No admin dependency.
export default function PlayerPageHeader({ title, description, eyebrow, detail, image, headingRef, children, Image = "img" }) {
  return <header className={`cd-page-header${image ? " has-artwork" : ""}`}>
    {image && <Image className="cd-page-artwork" src={image} alt="" />}
    <div>{eyebrow && <span className="cd-eyebrow">{eyebrow}</span>}<h1 ref={headingRef} tabIndex={-1}>{title}</h1><p>{description}</p>{detail && <p className="cd-authored-detail">{detail}</p>}</div>{children}
  </header>;
}
