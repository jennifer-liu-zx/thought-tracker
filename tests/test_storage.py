from app.storage import list_entries, read_entry, slugify, unique_dir, unique_path, write_entry


def test_slugify_basic():
    assert slugify("Hello, World!") == "hello-world"


def test_slugify_collapses_punctuation_to_single_hyphen():
    assert slugify("Dune: Part Two") == "dune-part-two"


def test_slugify_falls_back_when_nothing_alphanumeric():
    assert slugify("???") == "untitled"


def test_unique_path_avoids_collision(tmp_path):
    first = unique_path(tmp_path, "movie")
    first.write_text("x")
    second = unique_path(tmp_path, "movie")
    assert second.name == "movie-2.md"
    assert not second.exists()


def test_unique_dir_avoids_collision(tmp_path):
    first = unique_dir(tmp_path, "show")
    first.mkdir()
    second = unique_dir(tmp_path, "show")
    assert second.name == "show-2"
    assert not second.exists()


def test_write_and_read_entry_roundtrip(tmp_path):
    path = tmp_path / "entry.md"
    write_entry(path, {"title": "Test", "tags": ["a", "b"]}, "Body text")

    metadata, content = read_entry(path)

    assert metadata["title"] == "Test"
    assert metadata["tags"] == ["a", "b"]
    assert content.strip() == "Body text"


def test_write_entry_creates_parent_dirs(tmp_path):
    path = tmp_path / "nested" / "dir" / "entry.md"
    write_entry(path, {"title": "Nested"}, "")
    assert path.exists()


def test_list_entries_returns_empty_for_missing_dir(tmp_path):
    assert list_entries(tmp_path / "does-not-exist") == []


def test_list_entries_finds_nested_files_sorted(tmp_path):
    write_entry(tmp_path / "b" / "one.md", {"title": "B"}, "")
    write_entry(tmp_path / "a" / "two.md", {"title": "A"}, "")

    results = list_entries(tmp_path)

    assert [path.parent.name for path, _, _ in results] == ["a", "b"]
