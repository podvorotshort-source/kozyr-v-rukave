"""Собирает игру в один HTML-файл.

dist/index.html     — полноценная страница (открыть в браузере, загрузить на игровую площадку)
docs/index.html     — копия для GitHub Pages
dist/artifact.html  — тот же код без <html>/<head>/<body> для публикации артефактом Claude
"""
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
SCRIPTS = ["engine.js", "ai.js", "content.js", "run.js", "ui.js"]

TITLE = "Козырь в рукаве"
FONTS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Neucha'
    '&family=PT+Sans+Narrow:wght@700&family=PT+Sans:wght@400;700&family=Yeseva+One&display=swap">'
)


def read(name: str) -> str:
    return (SRC / name).read_text(encoding="utf-8")


def main() -> None:
    css = "[hidden] { display: none !important; }\n" + read("style.css")
    js = "'use strict';\n" + "\n".join(read(n) for n in SCRIPTS)
    body = read("body.html")
    head = f"<title>{TITLE}</title>\n{FONTS}\n<style>\n{css}</style>"
    script = f"<script>\n{js}</script>"

    DIST.mkdir(exist_ok=True)
    (DIST / "artifact.html").write_text(f"{head}\n{body}{script}\n", encoding="utf-8")
    page = (
        '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        f"{head}\n</head>\n<body>\n{body}{script}\n</body>\n</html>\n"
    )
    (DIST / "index.html").write_text(page, encoding="utf-8")
    docs = ROOT / "docs"  # GitHub Pages
    docs.mkdir(exist_ok=True)
    (docs / "index.html").write_text(page, encoding="utf-8")
    print(f"ok: {len(page) // 1024} КБ")


if __name__ == "__main__":
    main()
