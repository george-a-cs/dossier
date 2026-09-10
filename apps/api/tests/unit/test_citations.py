from dossier.generate.citations import (
    REFUSAL_TEXT,
    apply_refuse_policy,
    claimed_ids_from_answer,
    verify_citations,
)


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


def test_inline_cites_are_claimed_when_json_is_missing() -> None:
    text, ids = claimed_ids_from_answer("The recommended dose is 10 mg 【chk-1】.")
    assert text == "The recommended dose is 10 mg 【chk-1】."
    assert ids == ["chk-1"]


def test_fenced_chunk_json_is_stripped() -> None:
    raw = 'The recommended dose is 10 mg.\n```json\n{"chunk_ids":["chk-1"]}\n```'
    text, ids = claimed_ids_from_answer(raw)
    assert text == "The recommended dose is 10 mg."
    assert ids == ["chk-1"]


def test_inline_and_json_cites_are_merged() -> None:
    raw = 'Dose is 10 mg 【chk-1】.\n{"chunk_ids":["chk-2"]}'
    text, ids = claimed_ids_from_answer(raw)
    assert text == "Dose is 10 mg 【chk-1】."
    assert ids == ["chk-2", "chk-1"]
