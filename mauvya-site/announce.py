#!/usr/bin/env python3
"""Announces the contract address, which is the whole of going live.

    python3 announce.py 0x364810112c5929e0741863c8da3f1597264e8e13
    python3 announce.py 0x… --symbol MAU --chain Base
    python3 announce.py --clear            # back to "nothing is live yet"

It writes public/api/token, which Caddy serves as JSON with caching off. The
page reads that file on load: when it says announced, the registry turns live,
the address appears in full in the bar, and one click selects it. Until the
file exists the request 404s and the page stays where it is, which is why
nothing else has to change to announce.

Nothing here validates that the address is the right contract. It checks the
shape and copies it character for character, and the one thing worth checking,
that this is the contract you deployed, is yours to do on the explorer.
"""

import argparse
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
TOKEN = HERE / "public" / "api" / "token"

EXPLORERS = {
    "base": "https://basescan.org/token/",
    "base sepolia": "https://sepolia.basescan.org/token/",
    "arbitrum": "https://arbiscan.io/token/",
    "polygon": "https://polygonscan.com/token/",
    "ethereum": "https://etherscan.io/token/",
}


def main():
    ap = argparse.ArgumentParser(description="Announce the contract address on the site.")
    ap.add_argument("address", nargs="?", help="the contract address, 0x and 40 hex characters")
    ap.add_argument("--symbol", default="MAU", help="ticker shown in the registry (default MAU)")
    ap.add_argument("--chain", default="Base", help="chain name shown in the registry (default Base)")
    ap.add_argument("--explorer", help="full explorer URL; derived from the chain when omitted")
    ap.add_argument("--clear", action="store_true", help="remove the file and go back to not deployed")
    args = ap.parse_args()

    if args.clear:
        if TOKEN.exists():
            TOKEN.unlink()
            print(f"removed {TOKEN}: the registry reads not deployed again")
        else:
            print("nothing to clear, the registry already reads not deployed")
        return

    if not args.address:
        ap.error("give an address, or --clear")

    if not re.fullmatch(r"0x[0-9a-fA-F]{40}", args.address):
        sys.exit(f"that is not an address: expected 0x and 40 hex characters, got {args.address!r}")

    explorer = args.explorer or (EXPLORERS.get(args.chain.lower(), "") + args.address or None)

    TOKEN.parent.mkdir(parents=True, exist_ok=True)
    TOKEN.write_text(
        json.dumps(
            {
                "announced": True,
                "address": args.address,
                "symbol": args.symbol,
                "chain": args.chain,
                "explorer": explorer,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {TOKEN}")
    print(f"  {args.symbol} on {args.chain}: {args.address}")
    print(f"  explorer: {explorer or 'none'}")
    print("commit and push, and the deploy carries it.")


if __name__ == "__main__":
    main()
