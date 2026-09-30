import "./DialoguePlaybackControls.css";

export function DialogueVoiceButton({ playback, index, enabled, style }) {
  const entry = playback.entries[index];
  if (!entry.source) return null;
  const active = playback.playingIndex === index;
  return <button type="button" style={style} disabled={!enabled} aria-pressed={active}
    aria-label={`${active ? "Stop" : "Play"} ${entry.speaker} voice`}
    onClick={() => active ? playback.stop() : playback.play(index, false)}>
    {active ? "Stop voice" : "Play voice"}
  </button>;
}

export default function DialoguePlaybackControls({ playback, enabled = true }) {
  return (
    <div className="dialogue-playback">
      <div className="dialogue-playback-buttons">
        <button type="button" onClick={() => playback.play(0, true)} disabled={!enabled || !playback.hasAudio}>
          {playback.mode === "exchange" ? "Restart exchange" : "Play exchange"}
        </button>
        {playback.mode && <>
          <button type="button" onClick={playback.togglePause}>{playback.paused ? "Resume" : "Pause"}</button>
          <button type="button" onClick={() => playback.stop()}>Stop</button>
        </>}
      </div>
      <p className="dialogue-playback-status" role="status">
        {!playback.hasAudio ? "Recorded voice is not available for this chapter." : !enabled ? "Enable sound to hear dialogue." : playback.status || "Play the exchange or choose a voice."}
      </p>
    </div>
  );
}
