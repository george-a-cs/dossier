from dossier.ingest.chunking import TOKEN_BUDGET, chunk, token_count
from dossier.ingest.parsing import ParsedDocument, ParsedPage


def _doc(text: str, *, filename: str = "note.md", page: int = 1) -> ParsedDocument:
    return ParsedDocument(
        filename=filename,
        mime="text/markdown",
        kind="markdown",
        pages=[ParsedPage(page_number=page, text=text)],
    )


def test_short_doc_is_one_chunk() -> None:
    parsed = _doc("One sentence. Two sentence. Three sentence.")
    drafts = chunk(parsed, document_id="d1", filename="note.md")
    assert len(drafts) == 1
    assert drafts[0].chunk_index == 0


def test_long_doc_overlaps() -> None:
    paragraph = "alpha beta gamma delta epsilon zeta " * 80
    drafts = chunk(_doc(paragraph), document_id="d1", filename="note.md", token_budget=80, overlap=16)
    assert len(drafts) > 1
    assert all(draft.text.strip() for draft in drafts)
    assert token_count(drafts[0].text) <= 80 + 16
    first_tail = drafts[0].text.split()[-5:]
    assert any(word in drafts[1].text for word in first_tail)


def test_heading_becomes_section_title() -> None:
    text = "# Safety\n\nDo not exceed the labelled dose."
    drafts = chunk(_doc(text), document_id="d1", filename="label.md")
    assert drafts[0].section_title == "Safety"


def test_page_span_from_multiple_pages() -> None:
    parsed = ParsedDocument(
        filename="multi.md",
        mime="text/markdown",
        kind="markdown",
        pages=[
            ParsedPage(page_number=2, text="Second page paragraph about dose."),
            ParsedPage(page_number=3, text="Third page paragraph about food."),
        ],
    )
    drafts = chunk(parsed, document_id="d1", filename="multi.md")
    assert drafts[0].page_start == 2
    assert drafts[0].page_end == 3


def test_separate_calls_reset_index() -> None:
    parsed = _doc("Short.")
    a = chunk(parsed, document_id="a", filename="a.md")
    b = chunk(parsed, document_id="b", filename="b.md")
    assert a[0].chunk_index == 0
    assert b[0].chunk_index == 0


def test_budget_constant_is_512() -> None:
    assert TOKEN_BUDGET == 512
