import { getPlayingCardRankSlug, normalizeCardDisplayText } from "../cardArt";

export const COMPOSED_CARD_SIZE = Object.freeze({ width: 384, height: 536 });

// Both the battlefield texture and the inspection panel use this full-art face.
export function paintPublishedCardFace(context, card, illustration) {
  const { width, height } = COMPOSED_CARD_SIZE;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fcf7e9";
  context.fillRect(0, 0, width, height);
  if (illustration) {
    const sourceWidth = illustration.naturalWidth || width;
    const sourceHeight = illustration.naturalHeight || height;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const cropWidth = width / scale;
    const cropHeight = height / scale;
    context.drawImage(illustration, (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2,
      cropWidth, cropHeight, 0, 0, width, height);
  }

  // Soft parchment keeps labels legible without replacing the lower art panel.
  for (const [x, y] of [[0, 45], [width, height - 45]]) {
    const corner = context.createRadialGradient(x, y, 0, x, y, 185);
    corner.addColorStop(0, "rgba(252, 247, 233, 0.96)");
    corner.addColorStop(1, "rgba(252, 247, 233, 0)");
    context.fillStyle = corner;
    context.fillRect(0, 0, width, height);
  }
  const caption = context.createLinearGradient(0, height * 0.66, 0, height);
  caption.addColorStop(0, "rgba(252, 247, 233, 0)");
  caption.addColorStop(1, "rgba(252, 247, 233, 0.96)");
  context.fillStyle = caption;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#fcf7e9";
  context.lineWidth = 4;
  context.strokeRect(3, 3, width - 6, height - 6);

  const rank = getPlayingCardRankSlug(card).toUpperCase() || card.rank || card.value || "?";
  const rawSuit = normalizeCardDisplayText(card.suit).toLowerCase();
  const suit = ({ spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" })[rawSuit] || rawSuit;
  context.fillStyle = ["♥", "♦"].includes(suit) ? "#a32430" : "#20252c";
  context.textAlign = "center";
  context.textBaseline = "top";
  function drawCorner() {
    context.font = "bold 86px Georgia";
    context.fillText(rank, 48, 20, 76);
    context.font = "64px Georgia";
    context.fillText(suit, 48, 110, 70);
  }
  drawCorner();
  context.save();
  context.translate(width, height);
  context.rotate(Math.PI);
  drawCorner();
  context.restore();

  function lines(text, font) {
    context.font = font;
    const result = [];
    let line = "";
    for (const word of String(text || "").split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > 260) {
        result.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) result.push(line);
    return result;
  }
  const nameLines = lines(card.name || "Gauntlet", "bold 17px Georgia").slice(0, 2);
  const rules = card.rulesText || card.text || "";
  let fontSize = 14;
  let rulesLines = lines(rules, `${fontSize}px Arial`);
  while (rulesLines.length * (fontSize + 2) > 110 && fontSize > 9) {
    fontSize -= 1;
    rulesLines = lines(rules, `${fontSize}px Arial`);
  }
  const captionHeight = nameLines.length * 20 + rulesLines.length * (fontSize + 2);
  let y = Math.max(350, height - 28 - captionHeight);
  context.textAlign = "left";
  context.fillStyle = "#27271f";
  context.font = "bold 17px Georgia";
  for (const line of nameLines) {
    context.fillText(line, 24, y, 260);
    y += 20;
  }
  context.font = `${fontSize}px Arial`;
  for (const line of rulesLines) {
    if (y + fontSize > height - 16) break;
    context.fillText(line, 24, y, 260);
    y += fontSize + 2;
  }
}
