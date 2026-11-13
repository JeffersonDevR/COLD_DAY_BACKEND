"""Neutraliza el voseo rioplatense — opcional, NO aplicado por defecto.

El contenido de los prototipos es argentino de punta a punta (CABA, Palermo,
Belgrano, CUIT, COP-BA, pesos). Si el mercado es Argentina, el voseo es el
registro correcto y este script no debe correr. Si el producto sale a Colombia
o a un mercado neutro, correlo con --apply.

Uso:
    python neutralizar-voseo.py            # dry-run: muestra qué cambiaría
    python neutralizar-voseo.py --apply
"""

import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

# voseo -> tuteo neutro
MAP = {
    "tenés": "tienes",
    "podés": "puedes",
    "elegí": "elige",
    "registrá": "registra",
    "pedí": "pide",
    "subí": "sube",
    "deslizá": "desliza",
    "contá": "cuenta",
    "escribí": "escribe",
    "buscá": "busca",
    "revisá": "revisa",
    "actualizá": "actualiza",
    "necesitás": "necesitas",
    "diagnosticá": "diagnostica",
    "aceptá": "acepta",
    "ingresá": "ingresa",
    "tocá": "toca",
    "completá": "completa",
    # segunda tanda: el primer mapa no cubría los agudos ni los enclíticos
    "aprobá": "aprueba",
    "rechazá": "rechaza",
    "confirmá": "confirma",
    "coordiná": "coordina",
    "contanos": "cuéntanos",
    "decime": "dime",
    "fijate": "fíjate",
    "mirá": "mira",
    "probá": "prueba",
    "sabés": "sabes",
    "hacés": "haces",
}

RX = re.compile(r"\b(" + "|".join(map(re.escape, MAP)) + r")\b", re.I)


def repl(m: re.Match) -> str:
    sig = m.group(0)
    nuevo = MAP[sig.lower()]
    return nuevo[0].upper() + nuevo[1:] if sig[0].isupper() else nuevo


def main(argv):
    aplicar = "--apply" in argv
    total = 0
    for p in sorted(ROOT.rglob("*.html")):
        texto = p.read_text(encoding="utf-8")
        hits = list(RX.finditer(texto))
        if not hits:
            continue
        print(f"{'[dry] ' if not aplicar else ''}{p.parent.name}")
        for m in hits:
            frag = re.sub(r"\s+", " ", texto[max(0, m.start() - 40):m.end() + 35]).strip()
            print(f"   {m.group(0):<14} -> {repl(m):<14}  … {frag}")
        total += len(hits)
        if aplicar:
            p.write_text(RX.sub(repl, texto), encoding="utf-8", newline="")
    print(f"\n{total} ocurrencia(s) {'convertidas' if aplicar else 'detectadas'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
