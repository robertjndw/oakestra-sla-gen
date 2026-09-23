import pytest


@pytest.fixture(autouse=True)
def _stub_image_exists(request, monkeypatch):
    """Unit tests have no network access. Only the `llm` integration tests (which talk to a
    real LM Studio and, through it, real registries) should hit `image_exists` for real -
    everything else gets a stub that says every image exists, so tests that don't care about
    image checking don't need to know about it."""
    if "llm" in request.keywords:
        return
    monkeypatch.setattr("oakestra_sla_gen.generator.image_exists", lambda ref, timeout=5.0: True)
