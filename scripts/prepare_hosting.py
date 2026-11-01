"""Prepare public static files only; never deploy repository metadata or credentials."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
out = root / ".hosting-public"
if out.exists():
    raise SystemExit("Output exists; use the retained prepared directory or choose a clean checkout.")
out.mkdir()
files = sorted(root.glob("*.html")) + [root / "underspark-gacha-odds.json", root / "app-ads.txt"]
files += [root / "admin" / name for name in ("index.html", "app.js", "styles.css")]
for source in files:
    if source.is_symlink() or not source.is_file():
        raise SystemExit(f"Invalid public source: {source}")
    target = out / source.relative_to(root)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
print(f"Prepared {len(files)} static files ({sum(f.stat().st_size for f in files):,} bytes)")
