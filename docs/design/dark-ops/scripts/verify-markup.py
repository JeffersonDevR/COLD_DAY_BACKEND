"""Verificación de marcado para los prototipos de docs/design/dark-ops.

Sin navegador disponible en este entorno, esta es la red de seguridad:
parsea cada archivo, y reporta lo que la Ola 0/1 exige.

Uso:
    python verify-markup.py                 # los 22 archivos
    python verify-markup.py <ruta.html>...  # solo los indicados

Sale con código 1 si algún archivo tiene un problema bloqueante.
"""

import re
import sys
import pathlib
from lxml import html

try:  # consola de Windows en cp1252
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Reglas de la Ola 0 + Ola 1. Cada una: (needle, etiqueta, bloqueante)
DEUDA = [
    ("material-symbols", "font de iconos (ligaduras como texto)", True),
    ("data-alt=", "data-alt en lugar de alt", True),
    ("user-scalable", "zoom bloqueado", True),
    ("maximum-scale", "zoom bloqueado", True),
    ("focus:outline-none", "foco borrado sin reemplazo", True),
    ("focus:ring-0", "foco borrado sin reemplazo", True),
]


def check(path: pathlib.Path) -> bool:
    src = path.read_text(encoding="utf-8", errors="replace")
    problems = []

    try:
        doc = html.fromstring(src, parser=html.HTMLParser(encoding="utf-8", huge_tree=True))
    except Exception as exc:  # noqa: BLE001
        print(f"  x parse: {exc}")
        return False

    refs = set(re.findall(r'<use href="#([\w-]+)"', src))
    defs = set(re.findall(r'<symbol id="([\w-]+)"', src))
    if refs - defs:
        problems.append(f"iconos sin definir: {sorted(refs - defs)}")

    counts = {}
    for needle, label, _blocking in DEUDA:
        n = src.count(needle)
        if n:
            counts[label] = counts.get(label, 0) + n
    for label, n in counts.items():
        problems.append(f"{label} x{n}")

    tiny = [t for t in re.findall(r"text-\[(\d+(?:\.\d+)?)px\]", src) if float(t) < 12]
    if tiny:
        problems.append(f"texto <12px x{len(tiny)}")

    imgs_sin_alt = [i for i in doc.xpath("//img") if not i.get("alt")]
    if imgs_sin_alt:
        problems.append(f"imagenes sin alt x{len(imgs_sin_alt)}")

    # codificación: el daño más silencioso y más caro (ver repair-encoding.py)
    if src.startswith("\ufeff"):
        problems.append("BOM al inicio (reescribir sin BOM)")
    mojibake = sum(src.count(m) for m in ("Ã", "Â", "â€"))
    if mojibake:
        problems.append(f"doble codificación x{mojibake}")

    if not doc.xpath("//h1"):
        problems.append("sin <h1>")

    # barra inferior: una sola forma de anclarla (Ola 2)
    for tag in re.findall(r"<(?:nav|footer)\b[^>]*>", src, re.S):
        cm = re.search(r'class="([^"]*)"', tag)
        if not cm:
            continue
        cls = cm.group(1)
        if "fixed" in cls and "bottom-0" in cls:
            faltan = [t for t in ("inset-x-0", "mx-auto", "max-w-[390px]") if t not in cls]
            if faltan:
                problems.append(f"barra inferior mal anclada (falta {' '.join(faltan)})")

    icono_sin_ocultar = [
        s for s in doc.xpath("//span[contains(@class,'material-symbols')]")
        if s.get("aria-hidden") != "true"
    ]
    if icono_sin_ocultar:
        problems.append(f"iconos sin aria-hidden x{len(icono_sin_ocultar)}")

    estado = "OK  " if not problems else " -  "
    try:
        nombre = path.relative_to(ROOT).as_posix()
    except ValueError:
        nombre = path.name
    print(f"{estado}{nombre}")
    for p in problems:
        print(f"     - {p}")
    return not problems


def main(argv):
    targets = [pathlib.Path(a) for a in argv[1:]]
    if not targets:
        targets = sorted(ROOT.glob("*/*.html"))
    ok = [check(p) for p in targets]
    print(f"\n{sum(ok)}/{len(ok)} sin hallazgos")
    return 0 if all(ok) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
