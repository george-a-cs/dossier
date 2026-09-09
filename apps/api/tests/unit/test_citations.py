from dossier.generate.citations import REFUSAL_TEXT, apply_refuse_policy, verify_citations


def test_hallucinated_id_dropped() -> None:
    result = verify_citations(["real", "ghost"], {"real"})
    assert result.kept == ["real"]
    assert result.refused is False


def test_all_valid_unchanged() -> None:
    result = verify_citations(["a", "b"], {"a", "b"})
    assert result.kept == ["a", "b"]
    assert result.refused is False


def test_none_valid_is_refusal() -> None:
    result = verify_citations(["ghost"], {"real"})
    text, refused = apply_refuse_policy("The dose is 99 mg.", result)
    assert refused is True
    assert result.kept == []
    assert text == REFUSAL_TEXT


def test_duplicate_claimed_ids_are_unique() -> None:
    result = verify_citations(["a", "a", "b", "a"], {"a", "b"})
    assert result.kept == ["a", "b"]
    assert result.refused is False
