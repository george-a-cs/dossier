from dossier.generate.compatible_llm import _split_citations


def test_trailing_json_is_stripped() -> None:
    text, ids = _split_citations('The recommended dose is 10 mg.\n{"chunk_ids":["chk-1"]}')
    assert text == "The recommended dose is 10 mg."
    assert ids == ["chk-1"]


def test_missing_json_means_no_cites() -> None:
    text, ids = _split_citations("I do not know.")
    assert text == "I do not know."
    assert ids == []


def test_inline_cite_without_json_is_claimed() -> None:
    text, ids = _split_citations("The film was clear 【chk-1】.")
    assert text == "The film was clear 【chk-1】."
    assert ids == ["chk-1"]


def test_fenced_json_is_claimed() -> None:
    text, ids = _split_citations(
        'The film was clear.\n```json\n{"chunk_ids":["chk-1"]}\n```'
    )
    assert text == "The film was clear."
    assert ids == ["chk-1"]
