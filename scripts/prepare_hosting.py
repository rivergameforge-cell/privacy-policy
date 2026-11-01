"""Prepare public static files only; never deploy repository metadata or credentials."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
out = root / ".hosting-public"
files = sorted(root.glob("*.html")) + [root / "underspark-gacha-odds.json", root / "app-ads.txt"]
files += [root / "admin" / name for name in ("index.html", "app.js", "styles.css", "privacy.html")]
allowed = {p.relative_to(root) for p in files}
if out.is_symlink():
    raise SystemExit("Output must not be a symlink")
if out.exists():
    for existing in out.rglob("*"):
        if existing.is_symlink() or (existing.is_file() and existing.relative_to(out) not in allowed):
            raise SystemExit(f"Unexpected output entry: {existing}")
for source in files:
    if source.is_symlink() or not source.is_file():
        raise SystemExit(f"Invalid public source: {source}")
for source in files:
    target = out / source.relative_to(root)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
print(f"Prepared {len(files)} static files ({sum(f.stat().st_size for f in files):,} bytes)")
