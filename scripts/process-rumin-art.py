"""Prepare the selected Rumin generation outputs as production WebP assets."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--selection", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    selection = json.loads(args.selection.read_text(encoding="utf-8"))
    report = []

    for item in selection:
        source = args.source_dir / item["generatorOutput"]
        output = args.output_root / item["output"]
        output.parent.mkdir(parents=True, exist_ok=True)

        with Image.open(source) as image:
            image = image.convert("RGB")
            prepared = ImageOps.fit(
                image,
                tuple(item["dimensions"]),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
            prepared.save(output, "WEBP", quality=82, method=6, exif=b"")

        report.append(
            {
                "assetId": item["assetId"],
                "output": item["output"].replace("\\", "/"),
                "dimensions": item["dimensions"],
                "bytes": output.stat().st_size,
                "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
            }
        )

    if args.report:
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    else:
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
