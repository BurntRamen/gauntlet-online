import { buildMatchTranscript, formatMatchTranscript } from "@gauntlet/match-history";

export function downloadMatchTranscript(replay, documentImpl = document, urlImpl = URL) {
  const text = formatMatchTranscript(buildMatchTranscript(replay));
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = urlImpl.createObjectURL(blob);
  const link = documentImpl.createElement("a");
  link.href = url;
  link.download = `gauntlet-match-${replay.matchId}.txt`;
  documentImpl.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => urlImpl.revokeObjectURL(url), 1000);
}
