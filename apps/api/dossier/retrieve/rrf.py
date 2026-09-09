from __future__ import annotations

RRF_K = 60


def rrf(lists: list[list[str]], k_const: int = RRF_K) -> list[str]:
    """Reciprocal rank fusion. Rank is 1-based. Higher fused score wins."""
    scores: dict[str, float] = {}
    for ranking in lists:
        for rank, item_id in enumerate(ranking, start=1):
            scores[item_id] = scores.get(item_id, 0.0) + 1.0 / (k_const + rank)
    return sorted(scores, key=lambda item_id: scores[item_id], reverse=True)


def rrf_scores(lists: list[list[str]], k_const: int = RRF_K) -> dict[str, float]:
    scores: dict[str, float] = {}
    for ranking in lists:
        for rank, item_id in enumerate(ranking, start=1):
            scores[item_id] = scores.get(item_id, 0.0) + 1.0 / (k_const + rank)
    return scores
