import { render } from "@testing-library/react";
import CampaignCinematic from "./CampaignCinematic";
import { getCampaignSpeakerImage } from "./CampaignDialogueBlock";

test("campaign speakers use same-faction fallbacks without borrowing another faction's artwork", () => {
  expect(getCampaignSpeakerImage("Unknown envoy", "xendra")).toContain("faction-art-unavailable.svg");
  expect(getCampaignSpeakerImage("Krauth", "xendra")).toContain("faction-art-unavailable.svg");
  expect(getCampaignSpeakerImage("Zalara", "zynarth")).toContain("factions/zynarth/");
  expect(getCampaignSpeakerImage("Kaiser", "rumin")).toContain("kaiser-gauntlet.webp");
});

test("cinematic backdrop and speaker do not borrow another faction's image", () => {
  const { container } = render(<CampaignCinematic cinematic={{ title: "The crossing", image: "/assets/gauntlet/bizi-card.webp" }} factionId="xendra" lines={["Krauth: The story continues."]} audioEnabled={false} />);
  expect(container.querySelector(".campaign-cinematic-backdrop").style.backgroundImage).toContain("faction-art-unavailable.svg");
  expect(container.querySelector(".campaign-cinematic-character .animated-character-portrait-art").getAttribute("src")).toContain("faction-art-unavailable.svg");
});
