import { definition, TYPES } from "@gauntlet/duel-rules/supportContract";

export default function SupportContractSummary({ card }) {
  if (!TYPES.has(card?.type)) return null;
  const contract = definition(card);
  if (!contract) return <p role="alert">Unsupported support effect. Select a deployed effect matching this faction and type.</p>;
  return <section aria-label="Support rules contract">
    <h5>Support Zone rules</h5>
    <dl>
      <dt>Cost</dt><dd>{card.value} printed value; existing pitch and payment modifiers apply.</dd>
      <dt>Timing</dt><dd>Open priority. No responsive play during combat.</dd>
      <dt>On play</dt><dd>{contract.onPlay || "No on-play instruction."}</dd>
      <dt>Activated / continuous effect</dt><dd>{contract.ongoing ? card.text : contract.onPlay ? "Only the printed on-play instruction and its resulting pending effect." : "No effect while occupying a Support Zone."}</dd>
      {contract.paymentEffect && <><dt>Payment from hand</dt><dd>{card.text}</dd></>}
      <dt>Duration</dt><dd>{contract.duration}</dd>
      <dt>Charges</dt><dd>{contract.charges ?? "Not consumed by triggering"}</dd>
      <dt>Discard condition</dt><dd>{contract.discardCondition}</dd>
    </dl>
    <p>Timing, printed cost, duration and exit conditions are deployed rules. Only the existing effect selector and its declared parameters are editable; arbitrary mechanics require code.</p>
  </section>;
}
