// Public operator destinations. Legacy routes retain their existing editor authority.
function destination(area, domain) {
  if (["Players", "Matches", "System", "Operations"].includes(area)) return "Operations";
  if (["Competition", "Store & Economy", "Para League & Economy", "Events & Commerce"].includes(area) || domain === "offers" || /^(para|competition):/.test(domain || "")) return "Events & Commerce";
  if (area === "Website" || domain === "modes") return "Website";
  if (["Content", "Design", "Game", "Create & Edit"].includes(area)) return "Create & Edit";
  return area === "Publishing" ? area : "Home";
}
function editorArea(area, domain) {
  if (area === "Website" || area === "Create & Edit") return "Content";
  if (area === "Events & Commerce") return domain === "offers" ? "Store & Economy" : "Competition";
  return ({ Design: domain === "offers" ? "Store & Economy" : "Content", Game: "Content", Overview: "Home", System: "Operations", Matches: "Operations", "Para League & Economy": "Competition" })[area] || area;
}
module.exports = { destination, editorArea };
