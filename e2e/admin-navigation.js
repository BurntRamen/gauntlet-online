async function area(page, name) {
  const target = { Design: "Content", Overview: "Home", Matches: "Operations", System: "Operations", "Para League & Economy": "Competition" }[name] || name;
  await page.getByRole("navigation", { name: "Administration sections" }).getByRole("button", { name: target, exact: true }).click();
  if (["Matches", "System"].includes(name)) {
    const workspace = page.getByRole("navigation", { name: "Operations workspaces" });
    if (await workspace.isVisible()) await workspace.getByRole("button", { name: name === "Matches" ? "Match evidence" : "Health", exact: true }).click();
  }
}
async function paraTab(page, name) {
  const store = ["Marketplace", "Entitlements", "Gold Awards"].includes(name);
  if (store) {
    await area(page, "Store & Economy");
    await page.getByRole("navigation", { name: "Store & Economy workspaces" }).getByRole("button", { name: "Gold & Rewards", exact: true }).click();
  } else if (["Events", "Prestige"].includes(name) || !await page.getByRole("navigation", { name: "Para workspaces" }).isVisible()) { await area(page, "Competition"); await page.getByRole("navigation", { name: "Competition workspaces" }).getByRole("button", { name: "Para definitions", exact: true }).click(); }
  await page.getByRole("navigation", { name: "Para workspaces" }).getByRole("button", { name, exact: true }).click();
}
async function identity(page, value) {
  await page.getByText("Advanced · permanent identity", { exact: true }).click();
  await page.getByLabel("ID", { exact: true }).fill(value);
}
module.exports = { area, paraTab, identity };
