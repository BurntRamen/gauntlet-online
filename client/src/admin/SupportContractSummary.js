import {useHelp as useCreativeCopy} from "./AuthoringHelp";
import { definition, TYPES } from "@gauntlet/duel-rules/supportContract";
import { ID } from "@gauntlet/duel-rules/compositionContract";
import { explain } from "@gauntlet/duel-rules/compositionExplanation";
import Help from "./AuthoringHelp";
import { WorkshopFacts } from "./WorkshopShell";
import { label } from "./Presentation";

const meanings = {
  'optional-private-peek': 'Optionally look at hidden information',
  'next-attack-or-block': 'Prepares the next attack or block',
  'acceleration-and-next-card': 'Adds acceleration and prepares the next card',
  'captured-mechanic': 'Runs the mechanic’s placement abilities',
  resolution: 'Until its effect finishes',
  'until-text-removes': 'Until an effect removes it',
  'until-armed-combat-ends': 'Until the combat it was used in ends',
  'after-resolution': 'After its effect finishes',
  'after-chosen-peek': 'After the player chooses to look',
  'printed-consumption': 'When its card ability uses it up',
  'explicit-removal-only': 'Only when an effect removes it',
  'after-armed-combat': 'After the combat it was used in',
  'captured-cost-or-explicit-removal': 'When a mechanic’s cost uses it up, or an effect removes it'
};
const describe = value => meanings[value] || label(value);

export default function SupportContractSummary({ card }) {
  const creativeCopy=useCreativeCopy();

  if (!TYPES.has(card?.type)) return null;
  if (["authored-mechanic", "mechanic-program"].includes(card.effect?.id) && !card.effect.definition) return <Help topic="supportUnresolved" />;
  const contract = definition(card);
  if (!contract) return <Help role="alert" topic="supportUnsupported" />;
  return <section aria-label={creativeCopy.creativeSupportContractSummary1}>
    <h5>Support Zone rules</h5>
    <Help topic="supportRules" />
    <WorkshopFacts values={{ "Printed cost": card.value, "When played": contract.onPlay ? describe(contract.onPlay) : "No immediate effect",
      "Activated / continuous effect": contract.effectId === ID ? explain(card.effect, card) : contract.ongoing ? card.text : <Help topic={contract.onPlay ? "supportEntryOnly" : "supportNoEffect"} />,
      ...(contract.paymentEffect ? { "Payment from hand": card.text } : {}),
      "Stays in play": describe(contract.duration), Charges: contract.charges ?? "See ability", "Goes to discard": describe(contract.discardCondition) }} />
  </section>;
}
