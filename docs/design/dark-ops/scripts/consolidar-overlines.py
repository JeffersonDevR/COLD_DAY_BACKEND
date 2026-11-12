"""Consolida las etiquetas mono-uppercase en `.cd-overline` — Ola 4.

Cuarenta etiquetas usan Space Mono + mayúsculas + tracking como "disfraz de
técnico" (el craft floor lo llama *monospace as a costume*). Todas cumplen la
misma función —rotular— y ninguna es un dato, así que van al estilo de etiqueta
del sistema: Inter 12 px, peso 600, tracking .08em.

Se preserva el color semántico (text-primary, text-amber, text-emerald…) y se
descartan tamaño, familia, peso y tracking, que ahora los fija `.cd-overline`.

Uso:
    python consolidar-overlines.py            # dry-run
    python consolidar-overlines.py --apply
"""

import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

CLASE = re.compile(r'class="([^"]*)"')

# lo que deja de hacer falta: `.cd-overline` lo fija
DESCARTAR = re.compile(
    r"^(?:font-mono|font-label|font-headline|uppercase|tracking-[\w\[\]./-]+|"
    r"text-\[?\d+(?:\.\d+)?(?:px)?\]?|font-(?:bold|semibold|medium|normal)|"
    r"text-(?:slate|gray)-(?:300|400|500))$"
)
# colores con significado que hay que conservar
CONSERVAR = re.compile(r"^text-(?:primary|amber|violet|success|danger|emerald|cyan|red|\[\#)")


def hacer_reescritor(cambios: list):
    def reescribir(m: re.Match) -> str:
        clases = m.group(1).split()
        if "font-mono" not in clases or "uppercase" not in clases:
            return m.group(0)
        resto = [c for c in clases if not DESCARTAR.match(c)]
        nueva = "cd-overline " + " ".join(resto)
        cambios.append(" ".join(clases))
        return 'class="' + " ".join(nueva.split()) + '"'

    return reescribir


def main(argv):
    aplicar = "--apply" in argv
    total_etiquetas = 0
    validos = 0
    for p in sorted(ROOT.rglob("*.html")):
        if p.name.startswith("comparativa"):
            continue
        texto = p.read_text(encoding="utf-8")
        cambios = []
        out = CLASE.sub(hacer_reescritor(cambios), texto)
        # botones: la mayúscula de un CTA es grito, no estilo
        out, b = re.subn(
            r'(<button\b[^>]*class="[^"]*?)\s+uppercase\b',
            r"\1",
            out,
        )
        if cambios or b:
            validos += 1
            total_etiquetas += len(cambios)
            print(f"{'[dry] ' if not aplicar else ''}{p.parent.name[:44]:<46} etiquetas:{len(cambios)} botones:{b}")
            if aplicar:
                p.write_text(out, encoding="utf-8", newline="")
    print(f"\n{validos} archivo(s) tocados · {total_etiquetas} etiqueta(s) convertidas")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
