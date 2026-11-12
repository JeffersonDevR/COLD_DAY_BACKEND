"""Localiza los prototipos de Argentina a Colombia — Ola 3.

Alcance: geografía, vocabulario fiscal, electrodomésticos, unidades y moneda.
Los montos se reescalan ×6,5 a COP y quedan como **ilustrativos**.

Uso:
    python localizar-co.py            # dry-run
    python localizar-co.py --apply
"""

import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

# Del más específico al más general: si "CABA" va antes que "CABA / AMBA",
# el segundo nunca coincide.
REEMPLAZOS = [
    # direcciones completas
    ("Av. Cabildo 2450, 4º B, Belgrano, CABA", "Calle 72 #10-34, Apto 402, Usaquén, Bogotá"),
    ("Av. Cabildo 2450, CABA", "Calle 72 #10-34, Bogotá"),
    ("Av. Cabildo 2100, Belgrano", "Calle 72 #10-34, Usaquén"),
    ("Av. Cabildo 2450", "Calle 72 #10-34"),
    ("Av. Cabildo 2100", "Calle 72 #10-34"),
    ("Avenida Santa Fe 3420, Piso 4 B, Palermo", "Carrera 11 #85-20, Oficina 402, Chapinero"),
    ("Avenida Santa Fe 3420, Palermo", "Carrera 11 #85-20, Chapinero"),
    ("Avenida Santa Fe 3400, Recoleta", "Carrera 11 #85-20, Chicó"),
    ("Avenida Santa Fe 3420", "Carrera 11 #85-20"),
    ("Av. Santa Fe 3400", "Carrera 11 #85-20"),
    ("Scalabrini Ortiz al 2100", "Carrera 15 #85-40"),
    # barrios y ciudades
    ("CABA / AMBA", "Bogotá / Cundinamarca"),
    ("CABA y Norte", "Bogotá y norte"),
    ("Belgrano", "Usaquén"),
    ("Palermo", "Chapinero"),
    ("Recoleta", "Chicó"),
    ("Colegiales", "Cedritos"),
    ("AMBA", "Cundinamarca"),
    ("CABA", "Bogotá"),
    ("Argentina", "Colombia"),
    # vocabulario fiscal
    ("RUT / CUIT", "RUT / NIT"),
    ("Constancia de CUIT / RUT", "Constancia de NIT / RUT"),
    ("CUIT / CUIL", "NIT"),
    ("CUIT", "NIT"),
    ("AFIP", "DIAN"),
    ("COP-BA", "CONSEJO"),
    ("CBU / Alias", "Cuenta bancaria"),
    ("cuit_proveedor_afip_2024.pdf", "nit_proveedor_dian_2024.pdf"),
    ("extracto_banco_galicia_sep.pdf", "extracto_banco_sep.pdf"),
    # electrodomésticos y servicio
    ("heladera", "nevera"),
    ("Heladera", "Nevera"),
    ("HELADERA", "NEVERA"),
    ("lavarropas", "lavadora"),
    ("Lavarropas", "Lavadora"),
    ("LAVARROPAS", "LAVADORA"),
    ("BELGRANO", "USAQUÉN"),
    ("PALERMO", "CHAPINERO"),
    ("service", "mantenimiento"),
    ("Service", "Mantenimiento"),
]

AMOUNT = re.compile(r"\$\s?(\d[\d.]*)")
HORA = re.compile(r"(\d{1,2}:\d{2})\s*hs\b")
DURACION = re.compile(r"(\d+)\s+hs\b")
ARS = re.compile(r"\bARS\b")

FACTOR = 6.5


def cop(m: re.Match) -> str:
    n = int(m.group(1).replace(".", ""))
    valor = int(round(n * FACTOR / 500.0)) * 500
    return "$" + f"{valor:,}".replace(",", ".")


def main(argv):
    aplicar = "--apply" in argv
    total = 0
    for p in sorted(ROOT.rglob("*.html")):
        if p.name.startswith("comparativa"):
            continue
        texto = original = p.read_text(encoding="utf-8")
        ya_localizado = "Bogotá" in texto

        for viejo, nuevo in REEMPLAZOS:
            texto = texto.replace(viejo, nuevo)
        # no reescalar dos veces si el archivo ya está localizado
        if not ya_localizado:
            texto = AMOUNT.sub(cop, texto)
        texto = ARS.sub("COP", texto)
        texto = HORA.sub(r"\1", texto)
        texto = DURACION.sub(r"\1 h", texto)

        if texto == original:
            continue
        total += 1
        print(f"{'[dry] ' if not aplicar else ''}{p.parent.name}/{p.name}")
        if aplicar:
            p.write_text(texto, encoding="utf-8", newline="")

    print(f"\n{total} archivo(s) {'localizados' if aplicar else 'a localizar'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
