const content = [
  ['cards','Cards','cards','The playable card: its name, rules, values and availability.','Change what a card does.'],
  ['sets','Sets','cards','A collection of cards released together.','Group cards into an expansion.'],
  ['assets','Printings','cards','An artwork version of a card. It shares the card’s gameplay rules.','Give the same card alternate art.'],
  ['decks','Decks','cards','A saved recipe of cards and their quantities.','Build an opponent’s deck.'],
  ['encounters','Encounters','story','One campaign battle, with its story, opponent and setup.','Change a chapter’s opponent.'],
  ['campaigns','Campaign stories','story','The introduction and ordered chapters of a campaign.','Arrange a campaign’s journey.'],
  ['factions','Factions','story','A faction’s identity, presentation and supported shared rules.','Edit faction names and artwork.'],
  ['characters','Characters','story','A character’s name, portrait and presentation.','Update an opponent’s portrait.'],
  ['asset-library','Media library','cards','Reusable images and audio. Choosing a file links an exact saved version.','Upload art, then use it on a printing.'],
  ['mechanics','Mechanics Studio','rules','Build a reusable card ability from supported choices.','Draw a card when a support is placed.'],
  ['rule-modifiers','Rule modifiers','rules','Reusable starting life and hand-size settings for encounters and tests.','Start a campaign battle with less life.'],
  ['card-effects','Card effects','rules','The game’s built-in card abilities. Edit their allowed values on a compatible card.','Adjust a built-in ability’s bonus.'],
  ['faction-effects','Faction effects','rules','Rules shared by a faction. Edit the available settings on that faction.','Adjust a faction’s supported bonus.'],
  ['encounter-mechanics','Encounter mechanics','rules','Built-in boss abilities chosen in a campaign encounter.','Choose the opponent’s boss ability.'],
  ['game','Game settings','rules','Settings shared by supported game modes. Fixed rules remain read-only.','Change the starting and refill hand size.']
];
export const contentDestinations = content.map(([id,name])=>[id,name]);

export function ContentGuide({ domain, onSelect }) {
  const selected=content.find(([id])=>id===domain);
  if(!selected) return null;
  return <aside className="admin-content-guide" aria-label="Workspace guide"><p>{selected[3]}</p><details><summary>{selected[2]==='rules'?'Which rules editor do I need?':'What is the difference between these items?'}</summary><div className="admin-type-key">{content.filter(item=>item[2]===selected[2]).map(([id,name,,meaning,example])=><div key={id} data-current={id===domain || undefined}><button type="button" aria-current={id===domain?'page':undefined} onClick={()=>onSelect(id)}>{name}</button><p>{meaning}<small>Example: {example}</small></p></div>)}</div><p className="admin-key-note"><strong>Unsaved</strong> = only in this browser. <strong>Saved draft</strong> = shared with operators. <strong>Published</strong> = available to players. Saving does not publish.</p></details></aside>;
}

const kinds={
  text:['Aa','Text','Words players read. Card wording alone does not change gameplay.'],
  integer:['123','Whole number','Enter a number without a decimal, within the range shown below.'],
  lines:['≡','List','One item per line. The order is kept.'],
  asset:['▧','Media link','Choose a saved image or audio version. Replacing this link keeps the old version available.'],
  assets:['≡','Media list','An ordered list of audio links. Keep blank entries when they align with dialogue.'],
  object:['⚙','Game rules','Use the controls to define behavior. Save and test changes before publishing.'],
  choice:['⌄','One choice','Choose one of the supported options.'],
  link:['↗','Linked item','Choose another saved item. Edit that item to change its own details.'],
  settings:['⚙','Settings','Use the controls to configure the supported choices.']
};
export function FieldKind({ definition }) {
  const type=definition.type;
  const key=kinds[type]?type:['modifier-reference','printing-edition','deck-reference'].includes(type)?'link':'settings';
  const [symbol,name,meaning]=kinds[key];
  return <details className="admin-field-key"><summary><span aria-hidden="true">{symbol}</span> {name}<span className="sr-only">: field help</span></summary><p>{meaning}</p></details>;
}

const terms=[
  ['Mechanic','A reusable rule you can attach to compatible cards.'],
  ['Ability','One instruction inside a mechanic. A mechanic can have several abilities.'],
  ['Trigger · when','The moment an ability runs. Example: when the card attacks.'],
  ['Requirement · if','A check that must pass. Example: your life is 10 or less.'],
  ['Cost · pay','What the player spends to use it, such as life or cards from hand.'],
  ['Effect · do','What changes in the game. Example: draw one card.'],
  ['Target · choose','The card, player or slot affected by an effect. Some are chosen automatically.'],
  ['Duration · how long','Immediate happens once; this combat or this turn ends at that boundary.']
];
export function MechanicKey({ studio }) {
  return <details className="admin-mechanic-key"><summary>Mechanic key · what do these words mean?</summary><dl>{terms.map(([word,meaning])=><div key={word}><dt>{word}</dt><dd>{meaning}</dd></div>)}</dl>{studio?.vocabulary?.length>0&&<details><summary>Game keywords</summary><dl>{studio.vocabulary.map(term=><div key={term.word}><dt>{term.word}</dt><dd>{term.meaning}</dd></div>)}</dl></details>}</details>;
}

export function BehaviorGuide({ current }) {
  const choices={legacy:['Built-in ability','Use an existing card ability and change its supported values.'],composition:['Custom arming ability','For supported Rumin armaments: build effects that run when used with an attack.'],program:['Reusable mechanics','Attach saved mechanics from Mechanics Studio. The same mechanic can be used by several cards.']};
  return <div className="admin-behavior-guide"><p><strong>{choices[current][0]}</strong> · {choices[current][1]}</p><details><summary>Compare ability types</summary><dl>{Object.entries(choices).map(([id,[name,meaning]])=><div key={id} data-current={current===id||undefined}><dt>{name}{current===id&&<small>Current choice</small>}</dt><dd>{meaning}</dd></div>)}</dl><p>Changing type replaces the current setup in your local edits. Existing abilities are not automatically converted. Save and test before publishing.</p></details></div>;
}
