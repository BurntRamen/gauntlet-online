# ElevenLabs development asset pipeline

ElevenLabs is available here only as an offline development tool. The React
client and production server make no ElevenLabs requests and never receive the
API key. Generated media is downloaded into ignored staging first; publishing a
reviewed file into `client/public` is a separate command.

The checked-in manifest at `scripts/elevenlabs-assets.json` contains an example
Gauntlet keyframe and a dependent animation. Edit that manifest, or copy it to
the ignored `scripts/elevenlabs-assets.local.json` for experiments.

The reviewed match-audio batch is in `scripts/elevenlabs-match-audio.json`.
The cohesive apparatus-family redesign is in
`scripts/elevenlabs-sonic-identity-v2.json`. The generated main-menu loop is in
`scripts/elevenlabs-menu-music.json`.

## Setup

Create a restricted ElevenLabs API key with only the generation permissions the
manifest needs. Image/video jobs use Image & Video (Flows), sound-effect jobs
use Sound Effects, and music jobs use Music. Put the key in the root `.env` file
or process environment, never in a `REACT_APP_*` variable:

```powershell
$env:ELEVENLABS_API_KEY = "your-key"
```

The tool uses Node's built-in `fetch`; no runtime or client dependency is added.

## Workflow

Validate and inspect the plan without making an API call:

```powershell
npm run assets:elevenlabs -- plan
```

Submit one job. Referenced dependencies are generated first. The confirmation
flag is mandatory because generation spends credits:

```powershell
npm run assets:elevenlabs -- generate --only priority-transfer-animation --confirm-cost
```

For sound effects, the same workflow calls the synchronous Sound Effects
endpoint and converts 44.1 kHz interleaved PCM to normalized 48 kHz mono WAV:

```powershell
npm run assets:elevenlabs -- generate --manifest scripts/elevenlabs-match-audio.json --only ability-activate-a --confirm-cost
```

Outputs and resumable generation state land in `artifacts/elevenlabs`, which is
gitignored. If a long video times out locally, collect the already-submitted job
without creating or charging for another generation:

```powershell
npm run assets:elevenlabs -- collect --only priority-transfer-animation
```

After visual review, publish the static file into the client. Publishing writes
a checked-in provenance record under `docs/generated-assets/elevenlabs` and
records the manifest's `reviewStatus` (provisional by default):

```powershell
npm run assets:elevenlabs -- publish --only priority-transfer-animation
```

Unlike generation, publishing `--only` copies exactly the named job; it does not
also publish that job's generation dependencies.

Publishing will not replace an existing client asset unless `--force` is given.
Likewise, a matching completed generation is reused; deliberately paying for a
new variant requires `--force-generation --confirm-cost`.

## Manifest fields

- `kind`: `image`, `video`, `sound-effect`, or `music`.
- `modelId`, `prompt`, and `parameters`: passed to the corresponding ElevenLabs
  Flows endpoint. Parameters are model-specific and unknown fields are rejected
  by ElevenLabs.
- `references`: optional media inputs such as `start_frame`, `end_frame`,
  `images`, `videos`, or `audios`. `{ "job": "another-id" }` chains a prior
  generation. `{ "path": "assets/reference.png" }` embeds a local reference.
- `clientOutput`: must remain under `client/public`; path escape is rejected.
- `outputFormat`: sound-effect response format. The production match batch uses
  `pcm_44100`; the tool downmixes and wraps it as browser-ready mono WAV.
- Music jobs use the synchronous Music compose endpoint. Set
  `music_length_ms` and `force_instrumental` in `parameters`; published music is
  a fixed client asset and does not make a runtime API call.
- `postProcess`: sound-effect controls such as `targetPeakDbfs` and the source
  `inputChannels` override.
- `reviewStatus`: optional `provisional`, `candidate`, or `approved` provenance
  state applied only during publication.

Signed download URLs are used immediately and are never persisted. The state
file stores only generation IDs, statuses, hashes, and local staging paths.

## Client integration note

Published images can be referenced by their `/assets/...` URL. Published video
is an MP4 source asset; integrate it through an HTML video element or a Babylon
video texture only after performance, crop, loop, and reduced-motion behavior
have been reviewed. For short gameplay cues, trim/transcode the source and keep
the optimized runtime derivative independently addressable in the presentation
kit rather than replacing the whole board with a composite animation.

Published sound effects are fixed client assets. The API key and ElevenLabs API
are never used by the live game. Add reviewed sounds to the presentation kit by
semantic cue ID and retain the previous file until the new mapping is verified.

Selected v2 candidates also have deterministic offline mastered derivatives.
This step performs compression and peak normalization only and never calls an
external service:

```powershell
npm run master:match-audio
```

The raw generated WAVs remain beside the `mastered` directory, and the kit
records the original pre-v2 runtime path for every active replacement.
