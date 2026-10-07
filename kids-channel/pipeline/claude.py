"""Every call to Claude goes through here: one structured-output request at a time."""

import json

import anthropic

from .config import MODEL

_client: anthropic.Anthropic | None = None


def client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(max_retries=4)
    return _client


def ask_json(system: str, prompt: str, schema: dict, effort: str = "medium",
             max_tokens: int = 32000) -> dict:
    """Ask Claude for a JSON object matching `schema` and return it parsed."""
    # Streamed so long answers (an SVG drawing can be large) don't hit the SDK's request timeout.
    with client().beta.messages.stream(
        model=MODEL,
        max_tokens=max_tokens,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        thinking={"type": "adaptive"},
        output_config={
            "effort": effort,
            "format": {"type": "json_schema", "schema": schema},
        },
        system=system,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        response = stream.get_final_message()
    if response.stop_reason == "refusal":
        raise RuntimeError(f"Claude declined the request: {response.stop_details}")
    if response.stop_reason == "max_tokens":
        raise RuntimeError("Claude's answer was cut off at max_tokens")
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text)
