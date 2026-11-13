"""Normaliza el anclaje de la barra inferior — Ola 2.

Hoy conviven cuatro formas de fijar la barra: dos centradas de verdad, una
pegada a la izquierda en escritorio (`left-0` + `mx-auto`, que no centra) y
una de 420 px que no coincide con el resto. Este script deja una sola.

Uso:
    python normalize-nav.py --dry-run
    python normalize-nav.py
"""

import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

CANON = ["fixed", "inset-x-0", "bottom-0", "mx-auto", "w-full", "max-w-[390px]"]
# tokens de posicionamiento/ancho que se reemplazan por CANON
POSICIONALES = {
    "fixed", "bottom-0", "inset-x-0", "left-0", "right-0", "left-1/2",
    "-translate-x-1/2", "w-full", "mx-auto", "max-w-[390px]", "max-w-[420px]",
}

NAV = re.compile(r"<nav\b[^>]*>", re.S)
CLASE = re.compile(r'class="([^"]*)"')


def normalizar(m: re.Match) -> str:
    tag = m.group(0)
    cm = CLASE.search(tag)
    if not cm:
        return tag
    clases = cm.group(1).split()
    if "fixed" not in clases or "bottom-0" not in clases:
        return tag
    resto = [c for c in clases if c not in POSICIONALES]
    nuevo = " ".join(CANON + resto)
    return tag[: cm.start(1)] + nuevo + tag[cm.end(1):]


def main(argv):
    dry = "--dry-run" in argv
    cambios = 0
    for p in sorted(ROOT.glob("*/*.html")):
        src = p.read_text(encoding="utf-8")
        out = NAV.sub(normalizar, src)
        if out != src:
            cambios += 1
            antes = [c for c in CLASE.findall(src) if "fixed" in c and "bottom-0" in c]
            despues = [c for c in CLASE.findall(out) if "fixed" in c and "bottom-0" in c]
            print(f"{'[dry] ' if dry else ''}{p.parent.name}/{p.name}")
            for a, d in zip(antes, despues):
                print(f"   antes:   {a[:105]}")
                print(f"   después: {d[:105]}")
            if not dry:
                p.write_text(out, encoding="utf-8")
    print(f"\n{cambios} archivo(s) con barra inferior normalizada")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
