import re
from pathlib import Path

import frontmatter


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "untitled"


def unique_path(dir_path: Path, base_slug: str) -> Path:
    """Return a non-colliding <dir_path>/<slug>.md path, appending -2, -3, ... as needed."""
    dir_path.mkdir(parents=True, exist_ok=True)
    candidate = dir_path / f"{base_slug}.md"
    n = 2
    while candidate.exists():
        candidate = dir_path / f"{base_slug}-{n}.md"
        n += 1
    return candidate


def unique_dir(parent_dir: Path, base_slug: str) -> Path:
    """Return a non-colliding <parent_dir>/<slug> directory path, appending -2, -3, ... as needed."""
    parent_dir.mkdir(parents=True, exist_ok=True)
    candidate = parent_dir / base_slug
    n = 2
    while candidate.exists():
        candidate = parent_dir / f"{base_slug}-{n}"
        n += 1
    return candidate


def read_entry(path: Path) -> tuple[dict, str]:
    post = frontmatter.load(path)
    return post.metadata, post.content


def write_entry(path: Path, metadata: dict, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    post = frontmatter.Post(content, **metadata)
    with open(path, "wb") as f:
        f.write(frontmatter.dumps(post).encode("utf-8"))


def list_entries(dir_path: Path) -> list[tuple[Path, dict, str]]:
    if not dir_path.exists():
        return []
    results = []
    for path in sorted(dir_path.rglob("*.md")):
        metadata, content = read_entry(path)
        results.append((path, metadata, content))
    return results
