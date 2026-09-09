from dossier.retrieve.rrf import RRF_K, rrf


def test_rrf_known_winner() -> None:
    # b is #2 in one list and #1 in the other. a appears in only one list.
    fused = rrf([["a", "b", "c"], ["b", "c", "d"]])
    assert fused[0] == "b"
    assert RRF_K == 60


def test_rrf_dedupes() -> None:
    fused = rrf([["a"], ["a"]])
    assert fused == ["a"]
