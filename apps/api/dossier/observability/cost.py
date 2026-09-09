from __future__ import annotations


def estimate_cost_usd(
    *,
    tokens_embed: int,
    tokens_in: int,
    tokens_out: int,
    price_embed_per_1m: float,
    price_llm_in_per_1m: float,
    price_llm_out_per_1m: float,
) -> float:
    return round(
        tokens_embed / 1e6 * price_embed_per_1m
        + tokens_in / 1e6 * price_llm_in_per_1m
        + tokens_out / 1e6 * price_llm_out_per_1m,
        6,
    )
