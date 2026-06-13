from app.agent_registry import category_counts, get_agent, list_agents, list_agent_categories, normalize_agent_type


def test_list_agents_returns_full_catalog():
    agents = list_agents()
    assert len(agents) >= 30


def test_agent_categories_cover_taxonomy():
    counts = category_counts()
    assert counts.get("foundational", 0) == 5
    assert counts.get("design_pattern", 0) == 3
    assert counts.get("multi_agent", 0) >= 4
    assert counts.get("human_integration", 0) == 2
    assert counts.get("industry", 0) == 6
    assert counts.get("infrastructure", 0) == 3
    assert counts.get("lifecycle", 0) == 2
    assert counts.get("operational", 0) >= 4


def test_list_agent_categories():
    categories = list_agent_categories()
    assert len(categories) == 8
    assert categories[0]["id"] == "foundational"


def test_normalize_agent_type_patterns():
    assert normalize_agent_type(None) == "conversational"
    assert normalize_agent_type("react") == "react"
    assert normalize_agent_type("hitl") == "hitl"
    assert normalize_agent_type("hermes") == "hermes"
    assert normalize_agent_type("invalid") == "conversational"


def test_get_agent_react():
    agent = get_agent("react")
    assert agent is not None
    assert agent["category"] == "design_pattern"


def test_get_agent_hermes():
    agent = get_agent("hermes")
    assert agent is not None
    assert agent["name"] == "Hermes Agent"
