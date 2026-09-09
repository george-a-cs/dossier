from dossier.observability.cost import estimate_cost_usd


def test_cost_math() -> None:
    cost = estimate_cost_usd(
        tokens_embed=1_000_000,
        tokens_in=1_000_000,
        tokens_out=500_000,
        price_embed_per_1m=0.02,
        price_llm_in_per_1m=0.15,
        price_llm_out_per_1m=0.60,
    )
    assert cost == 0.02 + 0.15 + 0.30
