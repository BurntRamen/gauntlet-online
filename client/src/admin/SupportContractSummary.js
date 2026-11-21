import {useHelp as useCreativeCopy} from "./AuthoringHelp";
import { definition, TYPES } from "@gauntlet/duel-rules/supportContract";
import { ID } from "@gauntlet/duel-rules/compositionContract";
import { explain } from "@gauntlet/duel-rules/compositionExplanation";
import Help from "./AuthoringHelp";
import { WorkshopFacts } from "./WorkshopShell";

export default function SupportContractSummary({ card }) {
  const creativeCopy=useCreativeCopy();

  if (!TYPES.has(card?.type)) return null;
  if (["authored-mechanic", "mechanic-program"].includes(card.effect?.id) && !card.effect.definition) return <Help topic="supportUnresolved" />;
  const contract = definition(card);
  if (!contract) return <Help role="alert" topic="supportUnsupported" />;
  return <section aria-label={creativeCopy.creativeSupportContractSummary1}>
    <h5>Support Zone rules</h5>
    <Help topic="supportRules" />
    <WorkshopFacts values={{ "Printed cost": card.value, "On play": contract.onPlay || "None",
      "Activated / continuous effect": contract.effectId === ID ? explain(card.effect, card) : contract.ongoing ? card.text : <Help topic={contract.onPlay ? "supportEntryOnly" : "supportNoEffect"} />,
      ...(contract.paymentEffect ? { "Payment from hand": card.text } : {}),
      Duration: contract.duration, Charges: contract.charges ?? "See effect", "Discard condition": contract.discardCondition }} />
  </section>;
}
