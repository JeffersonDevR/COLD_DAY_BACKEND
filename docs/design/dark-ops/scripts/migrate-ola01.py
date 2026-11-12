"""Migración mecánica Ola 0 + Ola 1 para los prototipos de docs/design/dark-ops.

Hace sólo lo que se puede hacer sin juicio de diseño; lo que necesita criterio
(tarjetas clickeables, switches, nav) lo reporta para editar a mano.

Uso:
    python migrate-ola01.py --dry-run b0_... c0_...
    python migrate-ola01.py b0_... c0_...
"""

import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ICONS = ROOT / "assets" / "icons.svg"

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

# material name -> id del sprite propio
ICON_MAP = {
    "arrow_back": "back", "arrow_forward": "arrow-right",
    "chevron_right": "chevron", "chevron_left": "back", "expand_more": "down",
    "expand_less": "up", "add": "plus", "close": "x", "check": "check",
    "menu": "menu", "search": "search", "more_vert": "menu",
    "notifications": "bell", "home": "home", "build": "wrench",
    "build_circle": "tool", "home_repair_service": "tool", "engineering": "tool",
    "assignment": "clipboard", "person": "person", "badge": "badge",
    "id_card": "badge", "location_on": "pin", "pin_drop": "pin",
    "place": "pin", "navigation": "nav-arrow", "near_me": "nav-arrow",
    "radar": "radar", "ac_unit": "snow", "mode_cool": "snow",
    "kitchen": "fridge", "local_laundry_service": "washer",
    "receipt_long": "receipt", "payments": "card", "credit_card": "card",
    "inventory_2": "box", "inventory": "box", "store": "store",
    "storefront": "store", "local_shipping": "truck", "two_wheeler": "moto",
    "local_offer": "tag", "visibility": "eye", "visibility_off": "eye",
    "edit": "edit", "sync": "sync", "tune": "sliders", "filter_list": "sliders",
    "schedule": "clock", "timer": "stopwatch", "hourglass_top": "hourglass",
    "priority_high": "alert", "warning": "alert", "error": "alert",
    "info": "info", "check_circle": "check-circle", "cancel": "x-circle",
    "verified": "shield-check", "verified_user": "shield-check",
    "shield": "shield", "lock": "lock", "battery_full": "battery",
    "battery_charging_full": "battery-charge",
    "signal_cellular_alt": "signal", "signal_cellular_4_bar": "signal",
    "wifi": "wifi", "star": "star", "call": "phone", "chat": "chat",
    "forum": "chat", "delete": "trash", "download": "download",
    "upload_file": "upload", "open_in_new": "external", "bolt": "bolt",
    "calendar_today": "calendar", "speed": "gauge",
    # segunda tanda
    "arrow_back_ios_new": "back", "mail": "mail", "apartment": "building",
    "corporate_fare": "building", "auto_mode": "auto", "home_pin": "pin",
    "my_location": "crosshair", "send": "nav-arrow", "settings": "sliders",
    "swap_horiz": "swap", "more_horiz": "more", "electric_moped": "moto",
    "moped": "moto", "phone": "phone", "mode_fan": "snow",
    "network_cell": "signal", "pending": "clock", "account_balance": "bank",
    "account_balance_wallet": "wallet", "add_circle_outline": "plus-circle",
    "dashboard": "grid", "cell_tower": "tower", "history_edu": "receipt",
    "microwave": "microwave",
}

SIZE_TOKENS = re.compile(r"text-\[\d+(?:\.\d+)?px\]|text-(?:xs|sm|base|lg|xl|2xl)\b")
SIZE_FROM = [
    (re.compile(r"text-\[(\d+)px\]"), lambda m: f"ico--{m.group(1)}"),
    (re.compile(r"text-\[(\d+)\.\d+px\]"), lambda m: "ico--20"),
    (re.compile(r"\btext-2xl\b"), lambda m: "ico--24"),
    (re.compile(r"\btext-xl\b"), lambda m: "ico--24"),
    (re.compile(r"\btext-lg\b"), lambda m: "ico--20"),
    (re.compile(r"\btext-base\b"), lambda m: "ico--20"),
    (re.compile(r"\btext-sm\b"), lambda m: "ico--16"),
    (re.compile(r"\btext-xs\b"), lambda m: "ico--14"),
]

ICON_SPAN = re.compile(
    r'<span\b[^>]*?class="([^"]*material-symbols[^"]*)"[^>]*>\s*([a-z0-9_]+)\s*</span>', re.S
)

VIEWPORT = re.compile(r'<meta[^>]*name=["\']viewport["\'][^>]*>', re.I)


def symbols_by_id():
    src = ICONS.read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r'<symbol id="([\w-]+)".*?</symbol>', src, re.S):
        out[m.group(1).removeprefix("i-")] = m.group(0)
    return out


def icon_size(cls: str) -> str:
    for rx, fn in SIZE_FROM:
        m = rx.search(cls)
        if m:
            return fn(m)
    return "ico--20"


def convert_icons(src: str, symbols):
    usado, desconocido = set(), set()

    def repl(m):
        cls, name = m.group(1), m.group(2)
        base = ICON_MAP.get(name)
        if base and base in symbols:
            usado.add(base)
            size = icon_size(cls)
            resto = SIZE_TOKENS.sub("", cls)
            resto = re.sub(r"material-symbols-\w+", "", resto)
            resto = " ".join(resto.split())
            extra = f" {resto}" if resto else ""
            return f'<svg class="ico {size}{extra}" aria-hidden="true" focusable="false"><use href="#i-{base}"/></svg>'
        desconocido.add(name)
        return m.group(0)

    return ICON_SPAN.sub(repl, src), usado, desconocido


def migrate(path: pathlib.Path, symbols, dry: bool) -> str:
    src = original = path.read_text(encoding="utf-8")

    # --- viewport ---
    src = VIEWPORT.sub(
        '<meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport">',
        src, count=1,
    )
    if 'name="color-scheme"' not in src:
        src = src.replace("</title>", '</title>\n<meta name="color-scheme" content="dark">', 1)

    # --- iconos primero: si queda alguno sin convertir, el font se queda ---
    src, usado, desconocido = convert_icons(src, symbols)

    # --- font de iconos fuera SÓLO si ya no quedan spans de ligadura ---
    if not re.search(r"<span[^>]*material-symbols", src):
        src = re.sub(r"\s*\.material-symbols[\w.-]*[^{]*\{[^}]*\}", "", src)
        src = re.sub(r'\n?<link[^>]*Material\+Symbols[^>]*>', "", src)

    # --- capa de diseño ---
    if "assets/coldops.css" not in src and "coldops.css" not in src:
        src = src.replace(
            "</head>",
            '<!-- Cold Day design layer (tokens, foco, tipografía, iconos) -->\n'
            '<link href="../assets/coldops.css" rel="stylesheet">\n</head>',
            1,
        )

    # --- a11y / contraste / tipografía ---
    src = src.replace("data-alt=", "alt=")
    # tokens completos, no substrings: "peer-focus:outline-none" no debe quedar en "peer-"
    src = re.sub(r'(?:^|[\s"])(?:[\w:-]*focus:(?:outline-none|ring-0))\b', "", src)
    src = src.replace("text-slate-500", "text-slate-400")
    src = re.sub(r"#64748b", "#94a3b8", src, flags=re.I)
    src = re.sub(r"text-\[(9|10|11)px\]", "text-[12px]", src)
    src = re.sub(r"--(?:font|text)-size:\s*(9|10|11)px", "font-size: 12px", src)

    # --- clases Tailwind inexistentes ---
    src = src.replace("h-4.5", "h-5").replace("px-4.5", "px-4").replace("py-0.2", "py-0.5")
    src = re.sub(r'class="absolute 1 ', 'class="absolute ', src)

    # --- targets de botones-ícono ---
    def btn_target(m):
        tag = m.group(0)
        if "aria-label" not in tag:
            return tag
        tag = tag.replace("w-9 h-9", "w-11 h-11").replace("h-9 w-9", "w-11 h-11")
        tag = tag.replace("w-10 h-10", "w-11 h-11").replace("h-10 w-10", "w-11 h-11")
        tag = re.sub(r'\bp-2\b', "p-3", tag)
        return tag

    src = re.sub(r"<button\b[^>]*>", btn_target, src)

    # --- inyectar defs (idempotente: sólo los que faltan) ---
    if usado:
        existentes = set(re.findall(r'<symbol id="i-([\w-]+)"', src))
        faltan = sorted(usado - existentes)
        if faltan:
            bloque = "".join(symbols[i] for i in faltan)
            if "</defs>" in src:
                src = src.replace("</defs>", bloque + "</defs>", 1)
            else:
                wrapper = (
                    '<svg aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">'
                    "<defs>" + bloque + "</defs></svg>"
                )
                src = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + "\n" + wrapper, src, count=1)

    if not dry and src != original:
        path.write_text(src, encoding="utf-8")

    # --- reporte ---
    pendientes = []
    restantes = len(re.findall(r"<span[^>]*material-symbols", src))
    if restantes:
        pendientes.append(f"{restantes} icono(s) de ligadura sin convertir (el font se mantiene)")
    n = len(re.findall(r"cursor-pointer", src))
    if n:
        pendientes.append(f"{n} cursor-pointer (tarjeta clickeable sin foco)")
    if 'class="sr-only peer"' in src:
        pendientes.append("switch sin <label>")
    if "aria-pressed" not in src and "tune" in original:
        pendientes.append("filtros sin aria-pressed")
    linea = f"  iconos: {len(usado)} -> svg"
    print(f"{'[dry] ' if dry else ''}{path.parent.name}{linea}")
    if desconocido:
        print(f"     sin mapear: {sorted(desconocido)}")
    for p in pendientes:
        print(f"     a mano: {p}")
    return src


def main(argv):
    dry = "--dry-run" in argv
    names = [a for a in argv[1:] if not a.startswith("--")]
    if not names:
        print("indicá carpetas"); return 2
    symbols = symbols_by_id()
    for name in names:
        if name.endswith(".html"):
            p = ROOT / name.replace("\\", "/")
        else:
            p = ROOT / name / "code.html"
        if not p.exists():
            print(f"  falta {p}"); continue
        migrate(p, symbols, dry)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
