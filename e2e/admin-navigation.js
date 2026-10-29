async function navigation(page) {
  await page.getByRole("region", { name: "Gauntlet Admin", exact: true }).waitFor({ state: "visible" });
  const nav = page.getByRole("navigation", { name: "Administration sections" });
  if (!await nav.isVisible()) await page.getByRole("button", { name: /Navigation$/ }).click();
  return nav;
}
async function area(page, name) {
  const target = { Design: "Content", Overview: "Home", Matches: "Operations", System: "Operations", "Para League & Economy": "Competition" }[name] || name;
  await (await navigation(page)).getByRole("button", { name: target, exact: true }).click();
  if (["Matches", "System"].includes(name)) {
    const workspace = page.getByRole("navigation", { name: "Operations workspaces" });
    if (await workspace.isVisible()) await workspace.getByRole("button", { name: name === "Matches" ? "Match evidence" : "Health", exact: true }).click();
  }
}
async function destination(page, name) {
  if (name === "Store") { await area(page, "Store & Economy"); await page.getByRole("navigation", { name: "Store & Economy workspaces" }).getByRole("button", { name: "Products", exact: true }).click(); return; }
  const targets = {
    Cards: ["Cards"], Decks: ["Decks"], Encounters: ["Campaigns & Encounters", "encounters"], Campaigns: ["Campaigns & Encounters", "campaigns"], Factions: ["Factions & Characters", "factions"], Characters: ["Factions & Characters", "characters"], "Characters / opponents": ["Factions & Characters", "characters"],
    "Engine / Rules": ["Mechanics & Rules", "card-effects"], "Website prose": ["Website Text"], "Collector artwork": ["Printings & Sets", "assets"], Sets: ["Printings & Sets", "sets"], "Other content": ["Campaigns & Encounters", "campaigns"]
  };
  const [group, type] = targets[name] || [name];
  const nav = await navigation(page);
  if (!await page.getByRole("navigation", { name: "Content destinations" }).isVisible()) {
    await nav.getByRole("button", { name: "Content", exact: true }).click();
    if (await page.getByRole("dialog", { name: "Unsaved local changes" }).isVisible()) return;
    await navigation(page);
  }
  await page.getByRole("navigation", { name: "Content destinations" }).getByRole("button", { name: group, exact: true }).click();
  if (await page.getByRole("dialog", { name: "Unsaved local changes" }).isVisible()) return;
  if (type) await page.getByRole("combobox", { name: "Content type", exact: true }).selectOption(type);
  await workspaceView(page, "Editor");
}
async function workspaceView(page, name) {
  const controls = page.locator('[aria-label="Workspace view"]');
  if (await controls.isVisible()) await controls.getByRole("button", { name, exact: true }).click();
  else if (name === "Editor") {
    // A retained Preview preference can outlive a test section or selection.
    // Use its actual preference control when there is no selected-record toggle.
    const preference = page.getByRole("combobox", { name: "Preview visibility", exact: true });
    if (await preference.count() && await preference.inputValue() === "true") {
      const options = page.getByLabel("Workspace options", { exact: true });
      if (!await preference.isVisible()) await options.click();
      await preference.selectOption("false");
      await options.click();
    }
  }
}
async function workspaceSection(page, workshop, label) {
  await page.getByRole("region", { name: workshop, exact: true }).waitFor({ state: "visible" });
  await workspaceView(page, "Editor");
  const select = page.getByRole("combobox", { name: `${workshop} section`, exact: true });
  if (await select.isVisible()) await select.selectOption({ label });
  else await page.getByRole("navigation", { name: `${workshop} sections`, exact: true }).getByRole("button", { name: label, exact: true }).click();
  await workspaceView(page, "Editor");
}
async function saveRecord(page, recordName) {
  await page.getByRole("region", { name: "Save record changes", exact: true }).getByRole("button", { name: recordName ? `Save changes to ${recordName}` : /^Save changes/ }).click();
}
async function refreshAdmin(page) {
  await page.getByRole("button", { name: "Refresh admin", exact: true }).isVisible() || await page.getByLabel("Workspace options", { exact: true }).click();
  await page.getByRole("button", { name: "Refresh admin", exact: true }).click();
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
module.exports = { area, paraTab, identity, navigation, destination, workspaceSection, workspaceView, saveRecord, refreshAdmin };
