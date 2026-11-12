"""Repara la doble codificación de los prototipos.

Causa: un pase con `Get-Content -Raw` + `Set-Content -Encoding UTF8` decodificó
los archivos como cp1252 y los volvió a escribir como UTF-8. Un archivo UTF-8
leído como cp1252 produce "Ã¡" donde había "á".

Reparación: utf-8 -> cp1252 -> utf-8 (inversa exacta del daño).

Uso:
    python repair-encoding.py --dry-run
    python repair-encoding.py
"""

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

MOJIBAKE = ("Ã", "Â", "â€")


def damageos(texto: str) -> int:
    return sum(texto.count(m) for m in MOJIBAKE)


def desmojibake(texto: str) -> bytes:
    """Vuelve a los bytes originales: cp1252, con los 5 huecos C1 crudos.

    cp1252 no define 0x81, 0x8D, 0x8F, 0x90, 0x9D; python los decodifica a
    U+008x pero se niega a codificarlos de vuelta. Se escriben tal cual.
    """
    out = bytearray()
    for ch in texto:
        try:
            out += ch.encode("cp1252")
        except UnicodeEncodeError:
            cp = ord(ch)
            if 0x80 <= cp <= 0x9F:
                out.append(cp)
            else:
                raise
    return bytes(out)


def main(argv):
    dry = "--dry-run" in argv
    tocados = 0
    fallidos = []
    for p in sorted(ROOT.rglob("*.html")):
        raw = p.read_bytes()
        tenia_bom = raw.startswith(b"\xef\xbb\xbf")
        try:
            texto = raw.decode("utf-8-sig")  # sin BOM: no es representable en cp1252
        except UnicodeDecodeError as exc:
            fallidos.append((p.name, f"no es utf-8: {exc}"))
            continue

        antes = damageos(texto)
        if not antes:
            if tenia_bom:
                tocados += 1
                print(f"{'[dry] ' if dry else ''}{p.parent.name}/{p.name}: sólo BOM")
                if not dry:
                    p.write_text(texto, encoding="utf-8", newline="")
            continue

        try:
            reparado = desmojibake(texto).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError) as exc:
            fallidos.append((p.name, f"no reversible: {exc}"))
            continue

        despues = damageos(reparado)
        if despues >= antes:
            fallidos.append((p.name, f"sin mejora ({antes} -> {despues})"))
            continue

        tocados += 1
        print(f"{'[dry] ' if dry else ''}{p.parent.name}/{p.name}: {antes} -> {despues}")
        if not dry:
            p.write_text(reparado, encoding="utf-8", newline="")

    print(f"\n{tocados} archivo(s) reparado(s)")
    for nombre, motivo in fallidos:
        print(f"  ! {nombre}: {motivo}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
