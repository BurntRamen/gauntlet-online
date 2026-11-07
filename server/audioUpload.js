"use strict";
const crypto = require("node:crypto");
const MAX_AUDIO = 10 * 1024 * 1024;
const fail = () => { throw Object.assign(new Error("Choose a complete PCM WAV file: mono/stereo, 8–96 kHz, 8/16/24/32-bit, up to 10 MiB and 10 minutes."), { status: 422 }); };
function processAudio(body) {
  if (body.length < 44 || body.length > MAX_AUDIO || body.toString("ascii",0,4) !== "RIFF" || body.toString("ascii",8,12) !== "WAVE" || body.readUInt32LE(4) !== body.length - 8) fail();
  let fmt, data;
  for (let offset = 12; offset < body.length;) {
    if (offset + 8 > body.length) fail();
    const kind = body.toString("ascii",offset,offset+4), size = body.readUInt32LE(offset+4), end = offset+8+size;
    if (end > body.length) fail();
    if (kind === "fmt ") { if (fmt) fail(); fmt = body.subarray(offset+8,end); }
    if (kind === "data") { if (data) fail(); data = body.subarray(offset+8,end); }
    offset = end + (size % 2);
    if (offset > body.length) fail();
  }
  if (!fmt || fmt.length < 16 || !data?.length || fmt.readUInt16LE(0) !== 1) fail();
  const channels = fmt.readUInt16LE(2), sampleRate = fmt.readUInt32LE(4), bits = fmt.readUInt16LE(14), alignment = channels * bits / 8;
  if (![1,2].includes(channels) || sampleRate < 8000 || sampleRate > 96000 || ![8,16,24,32].includes(bits) || fmt.readUInt16LE(12) !== alignment || fmt.readUInt32LE(8) !== sampleRate*alignment || data.length % alignment) fail();
  const durationMs = Math.ceil(data.length / (sampleRate*alignment) * 1000);
  if (durationMs < 1 || durationMs > 600000) fail();
  // Retain only the decoded PCM format and samples, stripping private metadata.
  const canonical = Buffer.alloc(44 + data.length + data.length%2);
  canonical.write("RIFF"); canonical.writeUInt32LE(canonical.length-8,4); canonical.write("WAVEfmt ",8); canonical.writeUInt32LE(16,16);
  fmt.copy(canonical,20,0,16); canonical.write("data",36); canonical.writeUInt32LE(data.length,40); data.copy(canonical,44);
  const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
  return { data: canonical.toString("base64"), metadata: { schemaVersion: "gauntlet.uploaded-audio.v1", sha256: digest(canonical), originalSha256: digest(body), bytes: canonical.length, mediaType: "audio/wav", durationMs, channels, sampleRate } };
}
module.exports = { processAudio, MAX_AUDIO };
