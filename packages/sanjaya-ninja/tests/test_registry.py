"""Tests for the provider registry."""

from __future__ import annotations

import pytest

from sanjaya_core.exceptions import DatasetNotFoundError
from sanjaya_core.mock import MockDataProvider
from sanjaya_core.types import ColumnMeta, DatasetCapabilities

from sanjaya_ninja.registry import ProviderRegistry


@pytest.fixture()
def reg() -> ProviderRegistry:
    return ProviderRegistry()


def _make_provider(key: str = "ds1") -> MockDataProvider:
    return MockDataProvider(
        key=key, label=key.title(), columns=[], data=[]
    )


class TestProviderRegistry:
    def test_add_and_get(self, reg: ProviderRegistry):
        p = _make_provider("ds1")
        reg.add(p)
        assert reg.get("ds1") is p

    def test_get_unknown_raises(self, reg: ProviderRegistry):
        with pytest.raises(DatasetNotFoundError):
            reg.get("nope")

    def test_list_keys(self, reg: ProviderRegistry):
        reg.add(_make_provider("b"))
        reg.add(_make_provider("a"))
        assert reg.list_keys() == ["a", "b"]

    def test_add_lazy(self, reg: ProviderRegistry):
        called = False

        def factory():
            nonlocal called
            called = True
            return _make_provider("lazy_ds")

        reg.add_lazy(factory, key="lazy_ds")
        assert "lazy_ds" in reg.list_keys()
        assert not called  # not materialised yet

        provider = reg.get("lazy_ds")
        assert called
        assert provider.key == "lazy_ds"

        # Second get should return the cached instance.
        assert reg.get("lazy_ds") is provider

    def test_all_providers_materialises_lazy(self, reg: ProviderRegistry):
        reg.add(_make_provider("eager"))
        reg.add_lazy(lambda: _make_provider("lazy"), key="lazy")
        all_p = reg.all_providers()
        assert {p.key for p in all_p} == {"eager", "lazy"}

    def test_clear(self, reg: ProviderRegistry):
        reg.add(_make_provider("x"))
        reg.clear()
        assert reg.list_keys() == []

    def test_discover_module_with_register_fn(self, reg: ProviderRegistry, tmp_path):
        """Create a temp module with register() and verify discovery."""
        import sys

        mod_file = tmp_path / "fake_datasets.py"
        mod_file.write_text(
            "from sanjaya_core.mock import MockDataProvider\n"
            "def register(registry):\n"
            "    registry.add(MockDataProvider(key='from_fn', label='From Fn', columns=[], data=[]))\n"
        )
        sys.path.insert(0, str(tmp_path))
        try:
            reg.discover_module("fake_datasets")
            assert reg.get("from_fn").key == "from_fn"
        finally:
            sys.path.remove(str(tmp_path))
            sys.modules.pop("fake_datasets", None)

    def test_discover_module_auto_collect(self, reg: ProviderRegistry, tmp_path):
        """Auto-collect module-level DataProvider instances."""
        import sys

        mod_file = tmp_path / "auto_datasets.py"
        mod_file.write_text(
            "from sanjaya_core.mock import MockDataProvider\n"
            "my_ds = MockDataProvider(key='auto_ds', label='Auto', columns=[], data=[])\n"
        )
        sys.path.insert(0, str(tmp_path))
        try:
            reg.discover_module("auto_datasets")
            assert reg.get("auto_ds").key == "auto_ds"
        finally:
            sys.path.remove(str(tmp_path))
            sys.modules.pop("auto_datasets", None)
