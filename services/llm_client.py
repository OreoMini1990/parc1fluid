from __future__ import annotations

import json
import re
from typing import Any

from config.settings import (
    ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    resolve_llm_provider,
)
from prompts.parse_orders import SYSTEM_PROMPT, build_user_message


class LLMNotConfiguredError(RuntimeError):
    pass


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start : end + 1])
        raise


def call_parse_llm(raw_text: str) -> dict[str, Any]:
    provider = resolve_llm_provider()
    if not provider:
        raise LLMNotConfiguredError(
            "OPENAI_API_KEY 또는 ANTHROPIC_API_KEY를 .env에 설정해 주세요."
        )

    user_msg = build_user_message(raw_text)

    if provider == "openai":
        from openai import OpenAI

        client = OpenAI(api_key=OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        content = resp.choices[0].message.content or "{}"
        return _extract_json(content)

    from anthropic import Anthropic

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    resp = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
        temperature=0.1,
    )
    parts = [b.text for b in resp.content if b.type == "text"]
    content = "\n".join(parts)
    return _extract_json(content)
