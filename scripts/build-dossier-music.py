"""Revoice existing faction themes as quiet, percussion-free dossier loops.

Requires numpy, scipy and soundfile. Run from any directory with Python 3.
No network, model calls, or paid generation. Source-derived pitches and source
hashes are saved so these interpretations can be audited and reproduced.
"""
from pathlib import Path
import hashlib
import json
import math

import numpy as np
import soundfile as sf
from scipy.ndimage import median_filter
from scipy.signal import resample_poly, stft

ROOT = Path(__file__).resolve().parents[1]
MUSIC = ROOT / "client/public/assets/gauntlet/music"
RATE = 22050
DURATION = 48
STEP = 0.75


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pitches(source):
    samples, rate = sf.read(source, always_2d=True)
    mono = samples.mean(axis=1)
    divisor = math.gcd(rate, RATE)
    mono = resample_poly(mono, RATE // divisor, rate // divisor)
    passage = mono[8 * RATE:40 * RATE]
    frequencies, times, spectrum = stft(passage, fs=RATE, nperseg=4096, noverlap=3584)
    magnitude = np.abs(spectrum)
    horizontal = median_filter(magnitude, size=(1, 19))
    vertical = median_filter(magnitude, size=(19, 1))
    harmonic = magnitude * horizontal**2 / (horizontal**2 + vertical**2 + 1e-12)
    midi = np.arange(36, 85)
    salience = []
    for note in midi:
        fundamental = 440 * 2 ** ((note - 69) / 12)
        energy = np.zeros(len(times))
        for partial, weight in [(1, 1), (2, 0.35), (3, 0.15)]:
            bins = np.abs(frequencies - fundamental * partial) <= max(6, fundamental * partial * 0.018)
            energy += harmonic[bins].max(axis=0) * weight
        salience.append(energy)
    salience = np.asarray(salience)
    # Half-second source windows become relaxed three-quarter-second phrases.
    windows = np.stack([salience[:, (times >= step / 2) & (times < (step + 1) / 2)].mean(axis=1) for step in range(64)])
    melody_midi = midi[(midi >= 55) & (midi <= 79)]
    melody_energy = windows[:, (midi >= 55) & (midi <= 79)]
    score = np.log(melody_energy + 1e-6)
    score -= score.max(axis=1, keepdims=True)
    # Favor a connected melodic contour over isolated harmonics or transients.
    transition = 0.12 * np.abs(melody_midi[:, None] - melody_midi[None, :])
    cumulative = score[0].copy()
    back = []
    for frame in score[1:]:
        paths = cumulative[:, None] - transition
        back.append(paths.argmax(axis=0))
        cumulative = frame + paths.max(axis=0)
    route = [int(cumulative.argmax())]
    for previous in reversed(back):
        route.append(int(previous[route[-1]]))
    melody = melody_midi[list(reversed(route))].tolist()
    chords = []
    for start in range(0, 64, 8):
        energy = windows[start:start + 8].mean(axis=0)
        chroma = np.array([energy[midi % 12 == pitch].sum() for pitch in range(12)])
        candidates = [(sum(chroma[(root + interval) % 12] for interval in intervals), root, intervals)
                      for root in range(12) for intervals in [(0, 3, 7), (0, 4, 7)]]
        _, root, intervals = max(candidates)
        chords.append([48 + root + interval for interval in intervals])
    return melody, chords


def render(melody, chords):
    loop = np.zeros(DURATION * RATE, dtype=np.float64)

    def add_note(note, start, length, gain, pad=False):
        time = np.arange(round(length * RATE)) / RATE
        frequency = 440 * 2 ** ((note - 69) / 12)
        if pad:
            envelope = np.minimum(time / 0.9, 1) * np.minimum((length - time) / 1.8, 1)
            wave = np.sin(2 * np.pi * frequency * time) + 0.12 * np.sin(2 * np.pi * frequency * 2 * time)
        else:
            envelope = (1 - np.exp(-time / 0.045)) * np.exp(-time / 0.95)
            envelope *= np.minimum((length - time) / 0.3, 1)
            wave = (np.sin(2 * np.pi * frequency * time)
                    + 0.22 * np.exp(-time / 0.45) * np.sin(2 * np.pi * frequency * 2 * time)
                    + 0.055 * np.exp(-time / 0.2) * np.sin(2 * np.pi * frequency * 3 * time))
        voice = wave * envelope * gain
        indices = (np.arange(len(time)) + round(start * RATE)) % len(loop)
        loop[indices] += voice
        if not pad:
            # A small diffuse tail wraps through the loop boundary without a cut.
            for delay, level in [(0.19, 0.12), (0.37, 0.07), (0.61, 0.035)]:
                loop[(indices + round(delay * RATE)) % len(loop)] += voice * level

    for index, note in enumerate(melody):
        # Let sustained source notes breathe instead of repeatedly striking them.
        if index and note == melody[index - 1] and index % 4:
            if index % 4 == 2:
                chord = chords[index // 8]
                add_note(chord[(index // 4) % 3] + 12, index * STEP, 3.8, 0.23)
            continue
        add_note(note, index * STEP, 3.8, 0.7 if index % 4 == 0 else 0.52)
    for index, chord in enumerate(chords):
        for note in chord:
            add_note(note - 12, index * 6, 7.8, 0.11, pad=True)
    loop -= loop.mean()
    loop *= min(10 ** (-23 / 20) / np.sqrt(np.mean(loop**2)), 0.48 / np.max(np.abs(loop)))
    return loop


def main():
    output = MUSIC / "dossiers"
    output.mkdir(parents=True, exist_ok=True)
    tracks = []
    for faction in ["rumin", "sheen", "frumo", "bizi"]:
        source = MUSIC / f"{faction}-1.mp3"
        melody, chords = pitches(source)
        samples = render(melody, chords)
        destination = output / f"{faction}-reverie.wav"
        sf.write(destination, samples, RATE, subtype="PCM_16")
        tracks.append({
            "faction": faction,
            "source": str(source.relative_to(ROOT)).replace("\\", "/"),
            "sourceSha256": sha256(source),
            "sourcePassageSeconds": [8, 40],
            "output": str(destination.relative_to(ROOT)).replace("\\", "/"),
            "outputSha256": sha256(destination),
            "durationSeconds": DURATION,
            "sampleRate": RATE,
            "peakDbfs": round(float(20 * np.log10(np.max(np.abs(samples)))), 2),
            "rmsDbfs": round(float(20 * np.log10(np.sqrt(np.mean(samples**2)))), 2),
            "melodyMidi": melody,
            "harmonyMidi": chords,
        })
        print(f"{faction}: {DURATION}s, peak {tracks[-1]['peakDbfs']} dBFS, RMS {tracks[-1]['rmsDbfs']} dBFS")
    manifest = ROOT / "docs/generated-assets/dossier-music.json"
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps({
        "method": "Spectral harmonic pitch extraction from existing faction themes, revoiced as slow soft keys and sine pads. Instrumental interpretations, not literal transcriptions; no source vocals or percussion are mixed into the output.",
        "generator": "scripts/build-dossier-music.py",
        "tracks": tracks,
    }, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
