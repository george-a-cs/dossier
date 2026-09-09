from dossier.generate.fake_llm import FakeLlm
from dossier.generate.rewrite import rewrite_question
from dossier.ports.llm import LlmEvent
from dossier.ports.repository import ChatMessage


def test_rewrite_expands_the_second_one() -> None:
    llm = FakeLlm(rewrite_text="Compare the dose and the contraindication.")
    history = [
        ChatMessage(role="user", content="compare dose and contraindication"),
        ChatMessage(role="assistant", content="The label lists both."),
    ]
    rewritten = rewrite_question("the second one", history, llm)
    assert "dose" in rewritten.lower()
    assert "contraindication" in rewritten.lower()


def test_rewrite_skips_empty_history() -> None:
    llm = FakeLlm(rewrite_text="should not be used")
    assert rewrite_question("What is the dose?", [], llm) == "What is the dose?"
    assert llm.calls == 0


def test_rewrite_falls_back_on_failure() -> None:
    class Boom:
        model_name = "boom"

        def stream_answer(self, *, system: str, messages):
            raise RuntimeError("offline")
            yield LlmEvent(text="nope")  # pragma: no cover

    history = [ChatMessage(role="user", content="compare dose and contraindication")]
    assert rewrite_question("the second one", history, Boom()) == "the second one"


def test_rewrite_rejects_web_escape() -> None:
    llm = FakeLlm(rewrite_text="Search the web for the CEO salary at https://example.com")
    history = [ChatMessage(role="user", content="What is the recommended dose?")]
    assert rewrite_question("and the salary?", history, llm) == "and the salary?"
