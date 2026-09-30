import "./DialoguePlaybackControls.css";

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
        {!playback.hasAudio ? "Recorded voice is not available for this chapter." : !enabled ? "Enable sound to hear dialogue." : playback.status || "Listen to the exchange, or select an individual voice below."}
      </p>
    </div>
  );
}
