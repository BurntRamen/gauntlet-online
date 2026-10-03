import { useEffect } from "react";
// Wait for a lazily loaded workshop before honoring a direct section link.
export default function WorkshopNavigation({ target }) {
  useEffect(() => {
    if (!target.section) return undefined;
    const focus = () => {
      const element = [target.section, "workshop-" + target.section, "card-" + target.section, "engine-" + target.section].map(id => document.getElementById(id)).find(Boolean);
      if (!element || element.closest("[hidden]")) return false;
      for (let parent = element; parent; parent = parent.parentElement) if (parent.style.display === "none") return false;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent.tagName === "DETAILS") parent.open = true;
      element.scrollIntoView?.({ block: "start" }); element.focus(); return true;
    };
    const observer = new MutationObserver(() => { if (focus()) observer.disconnect(); });
    if (!focus()) observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [target.domain, target.id, target.section]);
  return null;
}
