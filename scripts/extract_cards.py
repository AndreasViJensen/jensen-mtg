#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: extract_cards.py INPUT_HTML OUTPUT_JSON", file=sys.stderr)
        return 1

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    html = input_path.read_text(encoding="utf-8")

    match = re.search(r"const CARD_DATA = (\[.*?\]);", html, re.DOTALL)
    if not match:
        print("could not locate CARD_DATA in source HTML", file=sys.stderr)
        return 1

    cards = json.loads(match.group(1))
    slim_cards = []
    for card in cards:
        avg_norm = card.get("avgNorm")
        if not isinstance(avg_norm, (int, float)):
            continue

        slim_cards.append(
            {
                "name": card.get("name"),
                "setCode": card.get("setCode"),
                "rarity": card.get("rarity"),
                "colors": card.get("colors", []),
                "type": card.get("type"),
                "manaCost": card.get("manaCost"),
                "avgNorm": avg_norm,
                "avgRaw": card.get("avgRaw"),
                "controversy": card.get("controversy"),
            }
        )

    payload = {
        "sourceName": "SOS ratings v2",
        "sourceUrl": "https://toskicologist.github.io/MTG-draft-sets-infographics/sos-ratings-v2.html",
        "cards": slim_cards,
    }
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
