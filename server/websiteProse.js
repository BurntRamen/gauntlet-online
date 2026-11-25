"use strict";

// Optional presentation overrides on existing mode owners. Absence preserves
// the shipped wording and the exact hash of older releases and shared drafts.
const defaults = {
  practice: ["The training grounds", "Master your next move.", "Find your rhythm at the table. Learn the core game or put a faction through its paces against AI.", "Learn & experiment"],
  freeForAll: ["Private matches", "A seat at your table.", "Challenge a friend to a duel, bring a group together, or watch a match unfold.", "Play with friends"],
  ranked: ["The ranked arena", "Make your mark.", "Bring your best game. Find an opponent, build your record, and climb the seasonal standings.", "Enter the competition"],
  draft: ["The drafting room", "Every pick is a possibility.", "Draft your picks or open a Sealed pool. Build a deck that is yours, one card at a time.", "Draft & sealed"],
  campaign: ["The academy & the archives", "Begin your journey.", "Learn the rhythm of Gauntlet, then follow a commander through their campaign. Your next chapter is waiting."]
};
const fields = [["heroEyebrow", "Page overline", 80], ["heroTitle", "Page heading", 160], ["heroDescription", "Page introduction", 600], ["menuDetail", "Menu description", 80]];
const locations = { practice: "Learn & Rules → Practice", freeForAll: "Play → Join a Table", ranked: "Compete → Ranked", draft: "Draft", campaign: "Campaign" };
const surfaces = require("../shared/admin/websiteSurfaces.json");
const presentation = require("../shared/websitePresentation");
const {icons,visualFields} = require('../shared/admin/websiteVisuals');
const soundtrack = require("../shared/duel-rules/soundtrack.json");
const musicFields = soundtrack.flatMap(({key, title, source}) => [
  [key + "Title", {label:"Track title", type:"text", maxLength:160, required:true, defaultValue:title, note:"Shown in the player header."}],
  [key + "Audio", {label:"Recording", type:"asset", media:"audio", maxLength:600, defaultValue:source || "", note:"Choose or upload audio, then publish the shared draft to update this playlist slot."}]
]);
function soundtrackOverrides(row, versions, releaseId) {
  return Object.fromEntries(soundtrack.filter(({key}) => row?.[key+"Title"] || row?.[key+"Audio"]).map(({key,title,source}) =>
    [key, {title:row[key+"Title"] || title, source:require("./contentAssets").resolveAsset(row[key+"Audio"], versions, releaseId) || source}]));
}
function proseFields(id) {
  return Object.fromEntries([...(id === 'practice' ? [...musicFields, ['websiteNavigation', { label:'Website navigation', type:'website-navigation', defaultValue:presentation.defaultNavigation(), note:'Labels and ordering only. Destinations and access stay registered.' }]] : []), ...(defaults[id] || []).map((defaultValue, index) => {
    const [key, label, maxLength] = fields[index];
    return [key, { label, type: "text", maxLength, required: true, defaultValue, note: `Shown in ${locations[id]}. Presentation only; save to the shared draft, preview, then publish.` }];
  }), ...surfaces.filter(surface => surface.owner === id).flatMap(surface => [
    ...visualFields(surface.id).map(({key,element,part,type})=>[key,{label:`${surface.name} · ${element==='background'?'background':(presentation.labels[element] || element)+' '+(part==='artwork'?'artwork':'icon')}`,type,visual:{element,part},...(type==='asset'?{media:'image',maxLength:600,required:false}:{options:['',...icons]}),defaultValue:'',note:type==='asset'?'Choose an immutable image. Clear it to restore the original artwork.':'Choose an approved SuitFire icon. The empty option keeps the original icon.'}]),
    ...["title", "description"].map(part => [`${surface.id}Page${part === "title" ? "Title" : "Description"}`, { label: `${surface.name} · ${part === "title" ? "heading" : "introduction"}`, type: "text", maxLength: part === "title" ? 160 : 600, required: true, defaultValue: surface[part], note: `Shown in ${surface.name}. Save to the shared draft; publish from Publishing.` }]),
    [`${surface.id}PageImage`, { label: `${surface.name} · header image`, type: "asset", media: "image", maxLength: 600, required: false, defaultValue: "", note: "Optional decorative header artwork. Choose a versioned image; clearing it restores the standard header. Existing releases keep their original image." }],
    [`${surface.id}PageLayout`, {label:`${surface.name} · presentation`, type:'website-layout', page:surface.id, labels:Object.fromEntries(presentation.sectionIds(surface.id).map(id=>[id,presentation.labels[id] || id])), defaultValue:presentation.defaultLayout(surface.id), note:'Arrange registered shortcuts. Recovery, invitations, account and gameplay controls stay available.'}]
  ])]);
}
function projectProse(domains, versions = [], releaseId = "") {
  return Object.fromEntries(surfaces.map(surface => {
    const row = domains.game.find(mode => mode.id === surface.owner);
    const image = row?.[`${surface.id}PageImage`];
    return [surface.id, { ...Object.fromEntries(["title", "description"].map(part => [part, row?.[`${surface.id}Page${part === "title" ? "Title" : "Description"}`] ?? surface[part]])), ...(image ? { image: require("./contentAssets").resolveAsset(image, versions, releaseId) } : {}) }];
  }));
}
function projectPresentation(domains, versions = [], releaseId = '') {
  const factionIds=domains.factions.filter(f=>domains.campaigns.some(c=>c.id===f.id)).map(f=>f.id);
  return {version:1, soundtrack:soundtrackOverrides(domains.game.find(row=>row.id==='practice'), versions, releaseId), navigation:domains.game.find(row=>row.id==='practice')?.websiteNavigation, pages:Object.fromEntries(surfaces.map(surface=>{
    const row=domains.game.find(row=>row.id===surface.owner), visuals={tiles:{}};
    for(const field of visualFields(surface.id)) if(row?.[field.key]) {
      const value=field.type==='asset'?require('./contentAssets').resolveAsset(row[field.key],versions,releaseId):row[field.key];
      if(field.element==='background') visuals.background=value;
      else (visuals.tiles[field.element] ||= {})[field.part]=value;
    }
    return [surface.id,{...presentation.layoutFor(surface.id,row?.[`${surface.id}PageLayout`],factionIds),...(visuals.background || Object.keys(visuals.tiles).length?{visuals}: {})}];
  }))};
}
module.exports = { proseFields, projectProse, projectPresentation, surfaces };
