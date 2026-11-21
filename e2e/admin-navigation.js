const { expect } = require("@playwright/test");
async function navigation(page) {
  await page.getByRole("region", { name: "Gauntlet Admin", exact: true }).waitFor({ state: "visible" });
  const nav = page.getByRole("navigation", { name: "Administration sections" });
  if (!await nav.isVisible()) await page.getByRole("button", { name: /Navigation$/ }).click();
  return nav;
}
async function area(page, name) {
  const target = { Design: "Create & Edit", Content: "Create & Edit", Overview: "Home", Players: "Operations", Matches: "Operations", System: "Operations", Competition: "Events & Commerce", "Store & Economy": "Events & Commerce", "Para League & Economy": "Events & Commerce" }[name] || name;
  await (await navigation(page)).getByRole("button", { name: target, exact: true }).click();
  if (await page.getByRole("dialog", { name: "Unsaved local changes" }).isVisible()) return;
  const secondary = { Matches: "Match evidence", System: "Health & recovery", "Store & Economy": "Deck products", "Para League & Economy": "Events & seasons" }[name];
  if (secondary) await page.getByRole("navigation", { name: target + " workspaces" }).getByRole("button", { name: secondary, exact: true }).click();
}
async function destination(page, name) {
  if (name === "Store") { await area(page, "Store & Economy"); return; }
  if (name === "Website prose") { await area(page, "Website"); return; }
  const types={Cards:"cards",Decks:"decks",Encounters:"encounters",Campaigns:"campaigns",Factions:"factions",Characters:"characters","Characters / opponents":"characters","Engine / Rules":"card-effects","Collector artwork":"assets",Sets:"sets","Other content":"campaigns","Mechanics & Rules":"mechanics"};
  if (!await page.getByLabel("Content type",{exact:true}).isVisible()) await area(page,"Content");
  if (await page.getByRole("dialog",{name:"Unsaved local changes"}).isVisible()) return;
  await page.getByLabel("Content type",{exact:true}).selectOption(types[name]||name);
  if (await page.getByRole("dialog", { name: "Unsaved local changes" }).isVisible()) return;
  await workspaceView(page, "Editor");
  const backToList = page.getByRole("button", { name: "Back to list", exact: true });
  if (await backToList.isVisible()) await backToList.click();
}
async function returnFromPublishing(page) {
  if (await page.getByRole("region", { name: "Shared release review", exact: true }).isVisible()) {
    await expect(page.locator(".admin-save-context")).not.toHaveText("Working…");
    await page.getByRole("button", { name: "Back to previous view", exact: true }).click();
  }
}
async function workspaceView(page, name) {
  await returnFromPublishing(page);
  const controls = page.locator('[aria-label="Workspace view"]');
  if (name === "Preview") await controls.waitFor({ state: "visible" });
  if (await controls.isVisible()) await controls.getByRole("button", { name, exact: true }).click();
  else if (name === "Editor") {
    // A retained or automatic Preview preference can outlive a selection.
    // Use its actual preference control when there is no selected-record toggle.
    const preference = page.getByRole("combobox", { name: "Preview visibility", exact: true });
    if (await preference.count() && await preference.inputValue() !== "false") {
      const options = page.getByLabel("Workspace options", { exact: true });
      if (!await preference.isVisible()) await options.click();
      await preference.selectOption("false");
      await options.click();
    }
  }
}
async function workspaceSection(page, workshop, label) {
  await returnFromPublishing(page);
  await page.getByRole("region", { name: workshop, exact: true }).waitFor({ state: "visible" });
  await workspaceView(page, "Editor");
  const select = page.getByRole("combobox", { name: `${workshop} section`, exact: true });
  if (await select.isVisible()) await select.selectOption({ label });
  else await page.getByRole("navigation", { name: `${workshop} sections`, exact: true }).getByRole("button", { name: label, exact: true }).click();
  await workspaceView(page, "Editor");
}
async function searchCollection(page, label, value) {
  const search = page.getByLabel(label, { exact: true });
  await search.waitFor({ state: "attached" });
  if (!await search.isVisible()) await page.getByRole("button", { name: "Back to list", exact: true }).click();
  await search.fill(value);
}
async function saveRecord(page, recordName) {
  await page.getByRole("region", { name: "Save record changes", exact: true }).getByRole("button", { name: recordName ? `Save changes to ${recordName}` : /^Save changes/ }).click();
  await expect(page.locator(".admin-save-context")).not.toHaveText("Working…", { timeout: 45000 });
}
async function saveDefinition(page) {
  const name = page.getByLabel("Name", { exact: true });
  const expectedName = await name.inputValue();
  const button = page.getByRole("button", { name: "Save definition to draft", exact: true });
  const saved = page.waitForResponse(response => response.url().endsWith("/authoring/para-draft") && response.request().method() === "POST");
  await button.click();
  const response = await saved;
  expect(response.ok()).toBeTruthy();
  await response.finished();
  // Response headers arrive before the potentially large authoring body. A
  // disabled Save button also means busy, so wait for the acknowledged editor.
  await expect(name).toBeEnabled();
  await expect(name).toHaveValue(expectedName);
  await expect(page.getByRole("region", { name: "Para definition editor", exact: true }).getByRole("heading", { name: "Edit definition · Saved draft", exact: true })).toBeVisible();
  await expect(page.locator(".admin-save-context")).toHaveText("Saved to shared draft");
  await expect(button).toBeDisabled();
  await page.getByRole("button", { name: "Close definition", exact: true }).click();
  await expect(name).toHaveCount(0);
}
async function previewSavedDraft(page) {
  if (!await page.getByRole("button", { name: "Preview saved draft", exact: true }).isVisible()) await area(page, "Publishing");
  const pending = require("./buffered-admin-response").waitForBufferedAdminResponse(page, response => response.url().endsWith("/authoring/preview") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Preview saved draft", exact: true }).click();
  const response = await pending;
  expect(response.ok()).toBeTruthy();
  await expect(page.getByText("Saved draft preview is ready.", { exact: true })).toBeVisible({timeout:45000});
}
async function refreshAdmin(page) {
  await page.getByRole("button", { name: "Refresh admin", exact: true }).isVisible() || await page.getByLabel("Workspace options", { exact: true }).click();
  await page.getByRole("button", { name: "Refresh admin", exact: true }).click();
}
async function paraTab(page, name) {
  const store = ["Marketplace", "Entitlements", "Gold Awards"].includes(name);
  if (store) {
    await area(page, "Store & Economy");
    await page.getByRole("navigation", { name: "Events & Commerce workspaces" }).getByRole("button", { name: "Gold & rewards", exact: true }).click();
  } else if (["Events", "Prestige"].includes(name) || !await page.getByRole("navigation", { name: "Para workspaces" }).isVisible()) { await area(page, "Competition"); await page.getByRole("navigation", { name: "Events & Commerce workspaces" }).getByRole("button", { name: "Events & seasons", exact: true }).click(); }
  await page.getByRole("navigation", { name: "Para workspaces" }).getByRole("button", { name, exact: true }).click();
}
async function identity(page, value) {
  await page.getByText("Advanced · permanent identity", { exact: true }).click();
  await page.getByLabel("ID", { exact: true }).fill(value);
}
module.exports = { searchCollection, area, paraTab, identity, navigation, destination, workspaceSection, workspaceView, saveRecord, saveDefinition, previewSavedDraft, refreshAdmin };
