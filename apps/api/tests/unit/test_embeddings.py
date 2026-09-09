import httpx

from dossier.ingest.fake_embeddings import FakeEmbeddings
from dossier.ingest.openai_embeddings import CompatibleEmbeddings


def test_fake_embeddings_are_stable_and_distinct() -> None:
    fake = FakeEmbeddings(dimensions=8)
    once = fake.embed_texts(["dose"])
    twice = fake.embed_texts(["dose"])
    other = fake.embed_texts(["food"])
    assert once == twice
    assert once[0] != other[0]
    assert len(once[0]) == 8


def test_compatible_embeddings_uses_base_url(monkeypatch) -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        return httpx.Response(
            200,
            json={
                "data": [{"index": 0, "embedding": [0.1, 0.2, 0.3]}],
                "object": "list",
            },
        )

    transport = httpx.MockTransport(handler)
    original_post = httpx.post

    def fake_post(url, **kwargs):
        with httpx.Client(transport=transport) as client:
            return client.post(url, **kwargs)

    monkeypatch.setattr(httpx, "post", fake_post)
    adapter = CompatibleEmbeddings(
        base_url="https://example.test/v1",
        api_key="k",
        model_name="embed-x",
    )
    vectors = adapter.embed_texts(["hello"])
    assert vectors == [[0.1, 0.2, 0.3]]
    assert adapter.dimensions == 3
    assert calls[0].startswith("https://example.test/v1/embeddings")
    del original_post
