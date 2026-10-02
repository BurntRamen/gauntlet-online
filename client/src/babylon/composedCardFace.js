// Shared published card data supplies every label and the immutable illustration.
// The canvas is presentation only; no card identity or rule dispatch lives here.
export function paintPublishedCardFace(context, card, illustration) {
  const width = 384, height = 536;
  context.fillStyle = "#15242b";
  context.fillRect(0, 0, width, height);
  if (illustration) context.drawImage(illustration, 0, 0, width, 340);
  context.fillStyle = "rgba(10, 17, 22, 0.94)";
  context.fillRect(0, 328, width, 208);
  context.strokeStyle = "#d8b675";
  context.lineWidth = 5;
  context.strokeRect(5, 5, width - 10, height - 10);
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "#fff6dc";
  context.font = "bold 36px Georgia";
  context.fillText(`${card.rank || card.value} ${card.suit || ""}`, 18, 18, 348);
  function lines(text, font) {
    context.font = font;
    const result = []; let line = "";
    for (const word of String(text || "").split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > 344) { result.push(line); line = word; } else line = next;
    }
    if (line) result.push(line);
    return result;
  }
  const name = lines(card.name || "Gauntlet", "bold 22px Georgia");
  let y = 342;
  name.slice(0, 2).forEach((line) => { context.fillText(line, 20, y, 344); y += 26; });
  const rules = card.rulesText || card.text || card.faction || "";
  let fontSize = 17, rulesLines = lines(rules, `${fontSize}px Arial`);
  while (rulesLines.length * (fontSize + 2) > 510 - y && fontSize > 9) { fontSize -= 1; rulesLines = lines(rules, `${fontSize}px Arial`); }
  for (const line of rulesLines) { if (y + fontSize > 519) break; context.fillText(line, 20, y, 344); y += fontSize + 2; }
}
