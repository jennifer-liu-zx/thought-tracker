import shutil

from fastapi import APIRouter, HTTPException

from app.config import TV_DIR
from app.external.tmdb import get_season_episodes, search_tv
from app.models import EpisodeIn, EpisodeOut, ShowDetailOut, ShowIn, ShowOut
from app.storage import read_entry, slugify, unique_dir, write_entry

router = APIRouter(prefix="/api/tv", tags=["tv"])


def _show_dir(show_id: str):
    return TV_DIR / show_id


def _show_path(show_id: str):
    return _show_dir(show_id) / "show.md"


def _episodes_dir(show_id: str):
    return _show_dir(show_id) / "episodes"


def _episode_path(show_id: str, episode_id: str):
    return _episodes_dir(show_id) / f"{episode_id}.md"


def _list_episode_files(show_id: str):
    ep_dir = _episodes_dir(show_id)
    if not ep_dir.exists():
        return []
    return sorted(ep_dir.glob("*.md"))


def _show_to_out(show_id: str, metadata: dict, content: str) -> ShowOut:
    episode_count = len(_list_episode_files(show_id))
    return ShowOut(
        id=show_id,
        notes=content,
        episode_count=episode_count,
        **{k: v for k, v in metadata.items() if k != "notes"},
    )


def _episode_to_out(path, metadata: dict) -> EpisodeOut:
    return EpisodeOut(id=path.stem, **metadata)


@router.get("", response_model=list[ShowOut])
def list_shows():
    shows = []
    if TV_DIR.exists():
        for show_dir in sorted(TV_DIR.iterdir()):
            show_path = show_dir / "show.md"
            if show_path.exists():
                metadata, content = read_entry(show_path)
                shows.append(_show_to_out(show_dir.name, metadata, content))
    shows.sort(key=lambda s: s.title.lower())
    return shows


@router.get("/search")
async def search_shows_endpoint(q: str):
    return await search_tv(q)


@router.post("", response_model=ShowOut)
def create_show(show: ShowIn):
    base_slug = slugify(f"{show.title}-{show.year}" if show.year else show.title)
    show_dir = unique_dir(TV_DIR, base_slug)
    show_id = show_dir.name
    metadata = show.model_dump(exclude={"notes"})
    write_entry(_show_path(show_id), metadata, show.notes)
    return _show_to_out(show_id, metadata, show.notes)


@router.get("/{show_id}", response_model=ShowDetailOut)
def get_show(show_id: str):
    path = _show_path(show_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Show not found")
    metadata, content = read_entry(path)
    episodes = []
    for ep_path in _list_episode_files(show_id):
        ep_metadata, _ = read_entry(ep_path)
        episodes.append(_episode_to_out(ep_path, ep_metadata))
    episodes.sort(key=lambda e: (e.season, e.episode))
    show_out = _show_to_out(show_id, metadata, content)
    return ShowDetailOut(**show_out.model_dump(), episodes=episodes)


@router.put("/{show_id}", response_model=ShowOut)
def update_show(show_id: str, show: ShowIn):
    path = _show_path(show_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Show not found")
    metadata = show.model_dump(exclude={"notes"})
    write_entry(path, metadata, show.notes)
    return _show_to_out(show_id, metadata, show.notes)


@router.delete("/{show_id}")
def delete_show(show_id: str):
    show_dir = _show_dir(show_id)
    if not show_dir.exists():
        raise HTTPException(status_code=404, detail="Show not found")
    shutil.rmtree(show_dir)
    return {"ok": True}


@router.post("/{show_id}/import-season", response_model=list[EpisodeOut])
async def import_season(show_id: str, season_number: int):
    path = _show_path(show_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Show not found")
    metadata, _ = read_entry(path)
    tmdb_id = metadata.get("tmdb_id")
    if not tmdb_id:
        raise HTTPException(
            status_code=400,
            detail="This show has no tmdb_id (it wasn't added via TMDb search) — add episodes manually instead.",
        )
    tmdb_episodes = await get_season_episodes(tmdb_id, season_number)
    for ep in tmdb_episodes:
        episode_id = f"s{season_number:02d}e{ep['episode_number']:02d}"
        ep_path = _episode_path(show_id, episode_id)
        if ep_path.exists():
            continue  # never overwrite existing thoughts/watch_dates
        write_entry(
            ep_path,
            {
                "season": season_number,
                "episode": ep["episode_number"],
                "name": ep["name"],
                "air_date": ep["air_date"],
                "watch_dates": [],
                "thoughts": [],
            },
            "",
        )
    episodes = []
    for ep_path in _list_episode_files(show_id):
        ep_metadata, _ = read_entry(ep_path)
        episodes.append(_episode_to_out(ep_path, ep_metadata))
    episodes.sort(key=lambda e: (e.season, e.episode))
    return episodes


@router.put("/{show_id}/episodes/{episode_id}", response_model=EpisodeOut)
def upsert_episode(show_id: str, episode_id: str, episode: EpisodeIn):
    if not _show_path(show_id).exists():
        raise HTTPException(status_code=404, detail="Show not found")
    path = _episode_path(show_id, episode_id)
    metadata = episode.model_dump()
    write_entry(path, metadata, "")
    return _episode_to_out(path, metadata)


@router.delete("/{show_id}/episodes/{episode_id}")
def delete_episode(show_id: str, episode_id: str):
    path = _episode_path(show_id, episode_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Episode not found")
    path.unlink()
    return {"ok": True}
