const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const baseline = require('../docs/ability-visibility-audit-2026-09-30.json');
const assert = require('node:assert/strict');
assert.equal(new Set(baseline.records.map(r=>r.id)).size, baseline.records.length, 'Duplicate ability inventory entries');
assert.deepEqual(baseline.records.filter(r=>r.kind === 'constructed card').map(r=>r.id).sort(),
  require('../server/gameContent').COLLECTION_CARDS.map(c=>c.id).sort(), 'Update the inventory for the current card catalog');
const engineTests = ['server/test/ability-response-windows.test.js', 'server/test/ability-effects.test.js'];
const interactionTests = ['client/src/babylon/abilityVisibility.test.js'];
const representative = {
  'jali:watane': 'Spend, staged confirmation, stacked +2, expiry, private receipts, fresh opponent response and rejected-action atomicity.',
  'jali:katana': 'Staged confirmation, printed eligibility, stack with Watane, independent expiry and fresh opponent response.',
  'jali:basho': 'Fresh response and public formation preserved by both shared and live-server projections.',
  'mekan:monti': 'Staged confirmation, +1 receipt, response after prior opponent pass and rejected-target atomicity.',
  'gracus:epicura:attack': 'Attacking activation transfers priority to the opponent.',
  'gracus:epicura:block': 'Blocking activation returns priority to the attacker.',
  'jali:revenant': 'Automatic creation during combat does not create a new activation response window.',
  'frumo:polea:peek': 'Private inspection survives later actions; owner-only history and hidden opponent lane.',
  'bizi:focus:spend': 'Eligible owner retained through lane highlights; selected own lane and opponent rejection.',
  'rumin-forum-ledger-runner': 'Explicit payment recipient, selected marker and invalidation after deselection.'
};
// Set only after browser verification. A representative path is not exhaustive
// qualification of all targets, combinations, devices or network conditions.
const visuallyVerified = new Set(['jali:watane', 'jali:katana', 'frumo:polea:peek', 'mekan:monti', 'bizi:focus:spend', 'rumin-forum-ledger-runner']);
const rows = baseline.records.map(r => ({
  ...r,
  baselineObservation: { qualification: r.qualification, commit: baseline.auditedCommit },
  coverage: {
    inventoried: { status: 'complete', scope: 'All linked components and eight lifecycle facets mapped.' },
    mechanicallyTested: {
      status: representative[r.id] ? 'representative cases passed' : 'not individually qualified in this pass',
      scope: representative[r.id] || 'Existing family/catalog tests are a baseline; they do not prove every combination or lifecycle facet.',
      evidence: representative[r.id] ? [...engineTests, ...interactionTests] : []
    },
    visuallyVerified: {
      status: visuallyVerified.has(r.id) ? 'representative desktop path verified' : 'not visually verified',
      scope: visuallyVerified.has(r.id) ? 'Local preview, real adapter/engine and Babylon UI. Sound off; see checkpoint scenarios.' : 'No browser acceptance claim for this row.'
    },
    complete: false
  },
  qualification: 'Inventoried; see independent mechanical and visual coverage. Full lifecycle qualification remains open.'
}));
const outcomes = ['defect reproduced', 'defect reproduced', 'defect reproduced', 'defect reproduced', 'passed', 'mixed', 'passed', 'defect reproduced'];
const resolutions = [
  'Staged Jali activation plus structured stacks, current-value inspection and named history.',
  'Central successful-activation pass reset; Jali regression passes.',
  'Monti regression proves activation then pass preserves the opponent response.',
  'Named recipient choices replace implicit first-payment selection.',
  'Invalid target remains atomic; resources and passes unchanged.',
  'Shared projection passed at baseline; live-server re-masking found and fixed. Named feedback added.',
  'Private Acama projection passed at baseline; private Polea persistence now additionally tested.',
  'Owner-aware lane targets and selected state now pass adapter/scene regression.'
];
const report = {
  title: 'Ability visibility implementation checkpoint', date: '2026-09-30',
  branch: 'codex/ability-visibility', baselineCommit: baseline.auditedCommit,
  rulesVersion: require('../shared/duel-rules').RULES_VERSION,
  preview: 'http://127.0.0.1:3210/ability-preview',
  status: 'Working representative interactions delivered; the entire inventory is not yet qualified.',
  scope: { ...baseline.scope, versions: { ...baseline.scope.versions, rules: require('../shared/duel-rules').RULES_VERSION } },
  completionContract: baseline.completionContract,
  baselineProbes: baseline.completedEvidence.probes.map((p,i)=>({name:p.name,outcome:outcomes[i],checkpoint:resolutions[i]})),
  baselineProbeTotals: { passed:2, defectReproduced:5, mixed:1, inconclusive:0 },
  regressionEvidence: {
    fullSuites: { server: {passed:209,failed:0}, client:{passed:536,failed:0,suites:62}, qualificationScripts:{passed:37,failed:0}, finalUiRerun:{passed:86,failed:0} },
    build: {status:'passed',mainGzipKiB:173.2,totalGzipKiB:721.1,notes:'Initial-load limit unchanged; total JavaScript budget raised from 709 to 725 KiB for structured effect data, UI and opt-in preview.'},
    previousFamilyBaseline: { passed:13, failed:0, claim:'Existing tests, not regressions for the newly reproduced defects.' },
    beforeFix: { responseWindows:{passed:5,failed:4}, effectReceipts:{passed:0,failed:4}, claim:'These eight failures were observed before their corresponding fixes.' },
    afterFix: { responseWindows:{passed:9,failed:0}, effectReceipts:{passed:7,failed:0}, claim:'Includes the live Basho projection regression plus stacked attack/payment-domain and printed-eligibility combination checks.' },
    logs:['artifacts/ability-client-tests.log','artifacts/ability-server-tests.log','artifacts/ability-focused-tests.log','artifacts/ability-build.log']
  },
  scenarios: [
    {name:'Watane + Katana', status:'browser verified', result:'Selecting spends nothing; confirmation applies each source. Printed 5 + Watane 2 + Katana 2 = 9 persists after animations.'},
    {name:'Stack expiration',status:'browser verified',result:'Turn-end history names Watane 9 → 7 and Katana 7 → 5; card returns to printed 5.'},
    {name:'Private Polea peek',status:'browser verified',result:'Target remains hidden until confirmation. Owner inspection shows 7♦; result remains in private inspections after closing. Opponent/spectator privacy covered by automated projections.'},
    {name:'Monti → pass',status:'browser verified',result:'Activation retains priority and resets old passes; subsequent pass gives the opponent priority within the same turn.'},
    {name:'Focus targets / Gloves recipient',status:'representative browser path verified',result:'Own lane is visibly selected; preview names Focus +1 and acceleration 2 → 1. Gloves can target the second payment card; it is named and marked separately. Full pointer/device acceptance remains open.'},
    {name:'Disconnect, uncertain acknowledgement and stale selection',status:'adapter regressions passed',result:'Clear selection/preview. Unknown spending remains unknown and submission stays locked until an authoritative outcome. Live multi-client fault injection remains open.'},
    {name:'Reduced motion and fast turns',status:'partial',result:'Watane persistent explanation and Focus commitment preview verified with reduced motion and sound off. Receipt/cadence regression retains explanation data. Full fast-AI/device sweep remains open.'}
  ],
  delivered: [
    'Successful optional activations consistently reset old passes; Gracus keeps attack/block priority transfer. Automatic triggers remain distinct.',
    'Per-source temporary-effect records, context, duration, sanitized receipts, resource changes, pending effects and expiry history.',
    'Staged immediate ability paths; current values, private peek persistence, explicit payment recipient, target owner and selected markers.',
    'Existing printed labels and numerical combat/payment history retained and extended.',
    'Rules version advanced to v9 because response semantics changed.'
  ],
  remaining: [
    'Complete per-row browser and mechanical qualification for all 111 entries and every linked component.',
    'Migrate remaining combat replacements and automatic modifiers from legacy note strings to fully structured per-source records.',
    'Per-ability trigger progress and availability: shared counters and pending effects are implemented; every conditional path still needs its own acceptance check.',
    'Live multi-client reconnect/fault injection, all observer/replay knowledge boundaries, mobile layouts and fast AI combinations.',
    ...baseline.scope.exclusions.filter(x=>!x.includes('Full visual'))
  ],
  records: rows
};
const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table = (headers,rows) => '<table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
const facets = ['availability','choices','targets','preview','resolutionEvidence','persistentState','endingCondition'];
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${report.title}</title>
<style>body{font:16px/1.5 system-ui;color:#162d40;background:#f5f7fa;max-width:1200px;margin:32px auto;padding:0 20px}table{border-collapse:collapse;width:100%;background:white}td,th{padding:10px;text-align:left;border:1px solid #cbd6df;vertical-align:top}details{padding:14px;margin:10px 0;background:white;border:1px solid #cbd6df;border-radius:6px}summary{cursor:pointer;font-weight:650}small{display:block;font-weight:400}input{font:inherit;padding:12px;width:90%}.status{background:#fff1d8;border-left:4px solid #a96913;padding:14px}a{color:#14589c}h2{margin-top:32px}dt{font-weight:bold}dd{margin:0 0 12px}li{margin:7px 0}</style>
<h1>${report.title}</h1><p>30 September 2026 · main baseline ${report.baselineCommit.slice(0,7)} · rules ${report.rulesVersion}</p>
<p class="status">${report.status}</p><p><a href="${report.preview}">Open the working preview</a> · <a href="ability-visibility-checkpoint-2026-09-30.json">Structured checkpoint</a></p>
<h2>Delivered</h2><ul>${report.delivered.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>
<h2>Eight baseline probes: explicit outcomes</h2><p>5 defects reproduced · 2 passed · 1 mixed · 0 inconclusive. The original 13 tests remain a baseline.</p>
${table(['Probe','Baseline outcome','Checkpoint'],report.baselineProbes.map(x=>[x.name,x.outcome,x.checkpoint]))}
<h2>Regression evidence</h2><p>Before fixes: response-window tests 4 failed / 5 passed; effect receipt tests 4 failed / 0 passed. After fixes: 9 response tests and 7 effect/combination tests pass. Full suites: 209 server, 536 client and 37 qualification-script tests pass; the final UI rerun passes 86 tests. Production build and bundle checks pass. Logs are retained under artifacts/.</p>
${table(['Scenario','Coverage','Result / boundary'],report.scenarios.map(x=>[x.name,x.status,x.result]))}
<h2>Remaining qualification</h2><ul>${report.remaining.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>
<h2>111-entry inventory</h2><p>Inventoried, mechanically tested and visually verified are independent. The requirement text below is retained from the baseline audit; the coverage fields report this checkpoint.</p><input id="search" aria-label="Search ability inventory" placeholder="Search ability, faction or coverage status…">
${rows.map(r=>`<details class="record"><summary>${esc(r.name)}<small>${esc(r.faction)} · inventoried: complete · mechanics: ${esc(r.coverage.mechanicallyTested.status)} · visuals: ${esc(r.coverage.visuallyVerified.status)}</small></summary><p>${esc(r.fullRules)}</p><p><b>Components:</b> ${esc(r.components.join('; '))}</p><p><b>Tested scope:</b> ${esc(r.coverage.mechanicallyTested.scope)}</p><dl>${facets.map(k=>'<dt>'+esc(k)+'</dt><dd>'+esc(r[k].required || [r[k].condition,r[k].requiredProgress].filter(Boolean).join(' '))+'</dd>').join('')}<dt>Response opportunity</dt><dd>${esc(r.responsePolicy)}</dd><dt>Knowledge boundary</dt><dd>${esc(r.privacy)}</dd></dl></details>`).join('')}
<script>document.querySelector('#search').addEventListener('input',e=>{for(const r of document.querySelectorAll('.record'))r.hidden=!r.textContent.toLowerCase().includes(e.target.value.toLowerCase())})</script></html>`;
for (const [extension,body] of [['json',JSON.stringify(report,null,2)+'\n'],['html',html]]) fs.writeFileSync(path.join(root,'docs','ability-visibility-checkpoint-2026-09-30.'+extension),body);
console.log('Checkpoint generated: '+rows.length+' individually statused entries.');
