from __future__ import annotations

from typing import Any


SWE_FIXTURE_TASKS: list[dict[str, Any]] = [
    {
        "task_id": "fix_divide_by_zero",
        "description": "Guard divide() against division by zero",
        "files": {
            "calc.py": (
                "def divide(a, b):\n"
                "    return a / b\n"
            ),
            "test_calc.py": (
                "from calc import divide\n\n"
                "def test_divide():\n"
                "    assert divide(10, 2) == 5\n\n"
                "def test_divide_by_zero():\n"
                "    try:\n"
                "        divide(1, 0)\n"
                "        assert False, 'expected ValueError'\n"
                "    except ValueError:\n"
                "        pass\n"
            ),
        },
        "target_file": "calc.py",
        "proposed_content": (
            "def divide(a, b):\n"
            "    if b == 0:\n"
            "        raise ValueError('division by zero')\n"
            "    return a / b\n"
        ),
        "verify_command": "python -m pytest -q test_calc.py",
    },
    {
        "task_id": "implement_greet",
        "description": "Implement greet() to satisfy unit test",
        "files": {
            "greet.py": (
                "def greet(name):\n"
                "    raise NotImplementedError\n"
            ),
            "test_greet.py": (
                "from greet import greet\n\n"
                "def test_greet():\n"
                "    assert greet('CodeForge') == 'Hello, CodeForge'\n"
            ),
        },
        "target_file": "greet.py",
        "proposed_content": (
            "def greet(name):\n"
            "    return f'Hello, {name}'\n"
        ),
        "verify_command": "python -m pytest -q test_greet.py",
    },
    {
        "task_id": "fix_sum_positive",
        "description": "Filter negative values before summing",
        "files": {
            "stats.py": (
                "def sum_positive(values):\n"
                "    return sum(values)\n"
            ),
            "test_stats.py": (
                "from stats import sum_positive\n\n"
                "def test_sum_positive():\n"
                "    assert sum_positive([1, -2, 3, -4, 5]) == 9\n"
            ),
        },
        "target_file": "stats.py",
        "proposed_content": (
            "def sum_positive(values):\n"
            "    return sum(value for value in values if value > 0)\n"
        ),
        "verify_command": "python -m pytest -q test_stats.py",
    },
]


def load_swe_fixture_tasks(suite: str) -> list[dict[str, Any]]:
    normalized = suite.strip().lower() or "swe-fixtures"
    if normalized != "swe-fixtures":
        raise ValueError("suite must be swe-fixtures")
    return list(SWE_FIXTURE_TASKS)
