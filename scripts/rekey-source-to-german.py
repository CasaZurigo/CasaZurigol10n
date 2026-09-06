#!/usr/bin/env python3
"""Rekey CasaZurigol10n so Swiss German is the source language.

English catalog keys become the current German values. tr() literals and
exact quoted keys in app code follow. Rerun with --check after --apply.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOBILE = ROOT.parent
JSON_DIR = ROOT / "translations" / "reactnative"
IOS_L10N_STRINGS = ROOT / "translations" / "ios"
APP_STRINGS = MOBILE / "ios" / "CasaZurigo"

# German collapsed two English meanings. Give each a distinct Swiss German key
# before rekeying so the source language can actually name the difference.
DISAMBIGUATE_DE = {
    "%@ day ago": "vor %@ Tag",
    "%@ days ago": "vor %@ Tagen",
    "%@ hour ago": "vor %@ Stunde",
    "%@ hours ago": "vor %@ Stunden",
    "%@ minute ago": "vor %@ Minute",
    "%@ minutes ago": "vor %@ Minuten",
    "Date — soonest first": "Datum – nächste zuerst",
    "Date — latest first": "Datum – späteste zuerst",
    "Analytics": "Analysen",
    "Sports": "Sportarten",
}

SKIP_DIR_PARTS = {
    "node_modules",
    ".expo",
    ".git",
    "DerivedData",
    "build",
    ".build",
    "Pods",
    "xcuserdata",
}

SOURCE_GLOBS = [
    (MOBILE / "ios", "*.swift"),
    (MOBILE / "android", "*.ts"),
    (MOBILE / "android", "*.tsx"),
    (MOBILE / "android", "*.js"),
    (MOBILE / "android", "*.jsx"),
]

L10N_IMPORT = re.compile(
    r"CasaZurigol10n|@/CasaZurigol10n/reactnative/src",
    re.MULTILINE,
)

# First string argument of tr(...) or tr(String(...)), including extra args.
TR_FIRST_STRING = re.compile(
    r"""tr\(\s*(?:String\s*\(\s*)?(?P<q>["'`])(?P<body>(?:\\.|(?!(?P=q)).)*)(?P=q)""",
    re.DOTALL,
)


def load_json(path: Path) -> dict[str, str]:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, data: dict[str, str]) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def read_quoted(text: str, i: int) -> tuple[str, int]:
    q = text[i]
    i += 1
    out: list[str] = []
    while i < len(text):
        ch = text[i]
        if ch == "\\":
            if i + 1 >= len(text):
                raise ValueError("dangling escape")
            nxt = text[i + 1]
            if nxt == "n":
                out.append("\n")
            elif nxt == "t":
                out.append("\t")
            else:
                out.append(nxt)
            i += 2
            continue
        if ch == q:
            return "".join(out), i + 1
        out.append(ch)
        i += 1
    raise ValueError("unterminated quoted string")


def parse_strings(text: str) -> dict[str, str]:
    entries: dict[str, str] = {}
    i = 0
    n = len(text)
    while i < n:
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            i = n if end < 0 else end + 2
            continue
        if text[i] in " \t\r\n":
            i += 1
            continue
        if text[i] == "/" and i + 1 < n and text[i + 1] == "/":
            end = text.find("\n", i)
            i = n if end < 0 else end + 1
            continue
        if text[i] != '"':
            i += 1
            continue
        key, i = read_quoted(text, i)
        while i < n and text[i] in " \t\r\n":
            i += 1
        if i >= n or text[i] != "=":
            continue
        i += 1
        while i < n and text[i] in " \t\r\n":
            i += 1
        if i >= n or text[i] != '"':
            continue
        value, i = read_quoted(text, i)
        entries[key] = value
        semi = text.find(";", i)
        i = n if semi < 0 else semi + 1
    return entries


def escape_strings(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def dump_strings(path: Path, data: dict[str, str]) -> None:
    lines = [
        f'"{escape_strings(key)}" = "{escape_strings(data[key])}";'
        for key in sorted(data)
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def json_locales() -> list[Path]:
    return sorted(p for p in JSON_DIR.glob("*.json") if p.name != "english-to-german.json")


def strings_dirs() -> list[Path]:
    dirs = []
    if IOS_L10N_STRINGS.exists():
        dirs.append(IOS_L10N_STRINGS)
    if APP_STRINGS.exists():
        dirs.append(APP_STRINGS)
    return dirs


def should_skip(path: Path) -> bool:
    return any(part in SKIP_DIR_PARTS for part in path.parts)


def iter_source_files() -> list[Path]:
    files: list[Path] = []
    for base, pattern in SOURCE_GLOBS:
        if not base.exists():
            continue
        for path in base.rglob(pattern):
            if should_skip(path):
                continue
            if "CasaZurigol10n" in path.parts and path.suffix in {".ts", ".swift"}:
                # Package runtime, not app copy.
                if "Sources" in path.parts or path.name == "index.ts":
                    continue
            files.append(path)
    return files


def extract_tr_keys(text: str) -> list[str]:
    return [m.group("body").replace(r"\"", '"').replace(r"\'", "'") for m in TR_FIRST_STRING.finditer(text)]


def unescape_literal(body: str, quote: str) -> str:
    out: list[str] = []
    i = 0
    while i < len(body):
        if body[i] == "\\" and i + 1 < len(body):
            nxt = body[i + 1]
            mapping = {"n": "\n", "t": "\t", "r": "\r", quote: quote, "\\": "\\"}
            out.append(mapping.get(nxt, nxt))
            i += 2
            continue
        out.append(body[i])
        i += 1
    return "".join(out)


def collect_tr_literals(files: list[Path]) -> dict[str, list[str]]:
    found: dict[str, list[str]] = defaultdict(list)
    for path in files:
        text = path.read_text(encoding="utf-8")
        if not L10N_IMPORT.search(text) and "tr(" not in text:
            continue
        for match in TR_FIRST_STRING.finditer(text):
            key = unescape_literal(match.group("body"), match.group("q"))
            found[key].append(str(path.relative_to(MOBILE)))
    return found


def preferred_english(de_value: str, english_keys: list[str], used: set[str]) -> str:
    used_here = [k for k in english_keys if k in used]
    pool = used_here or english_keys
    if de_value in pool:
        return de_value
    identity = [k for k in pool if k == de_value]
    if identity:
        return identity[0]
    return sorted(pool)[0]


def build_mapping(
    de: dict[str, str], used_keys: set[str]
) -> tuple[dict[str, str], dict[str, str], list[str]]:
    working = dict(de)
    for english, german in DISAMBIGUATE_DE.items():
        if english in working:
            working[english] = german

    by_de: dict[str, list[str]] = defaultdict(list)
    for english, german in working.items():
        by_de[german].append(english)

    english_to_german: dict[str, str] = {}
    german_to_english: dict[str, str] = {}
    notes: list[str] = []
    for german, englishs in by_de.items():
        chosen = preferred_english(german, englishs, used_keys)
        german_to_english[german] = chosen
        for english in englishs:
            english_to_german[english] = german
            if english != chosen:
                notes.append(f"merge {english!r} -> {german!r} (keep locale rows from {chosen!r})")
    return english_to_german, german_to_english, notes


def rekey_locale(old: dict[str, str], german_to_english: dict[str, str]) -> dict[str, str]:
    new: dict[str, str] = {}
    for german, english in german_to_english.items():
        if english in old:
            new[german] = old[english]
        elif german in old:
            new[german] = old[german]
        else:
            new[german] = english
    return dict(sorted(new.items(), key=lambda kv: kv[0].casefold()))


def escape_literal(value: str, quote: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(quote, f"\\{quote}")
        .replace("\n", "\\n")
    )


def replace_tr_first_args(text: str, english_to_german: dict[str, str]) -> tuple[str, int]:
    count = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal count
        quote = match.group("q")
        literal = unescape_literal(match.group("body"), quote)
        german = english_to_german.get(literal)
        if german is None or german == literal:
            return match.group(0)
        count += 1
        return match.group(0).replace(
            f"{quote}{match.group('body')}{quote}",
            f"{quote}{escape_literal(german, quote)}{quote}",
            1,
        )

    return TR_FIRST_STRING.sub(repl, text), count


SKIP_QUOTE_PREFIX = re.compile(
    r"""(?:Image|NSImage|UIImage)\(\s*$|systemName:\s*$|named:\s*$"""
)


def replace_quoted_keys(text: str, english_to_german: dict[str, str]) -> tuple[str, int]:
    count = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal count
        prefix = match.string[max(0, match.start() - 48) : match.start()]
        if SKIP_QUOTE_PREFIX.search(prefix):
            return match.group(0)
        quote = match.group("q")
        body = match.group("body")
        literal = unescape_literal(body, quote)
        german = english_to_german.get(literal)
        if german is None or german == literal:
            return match.group(0)
        count += 1
        return f"{quote}{escape_literal(german, quote)}{quote}"

    pattern = re.compile(r"(?P<q>['\"])(?P<body>(?:\\.|[^\\])*?)(?P=q)")
    return pattern.sub(repl, text), count


def rewrite_source_file(path: Path, english_to_german: dict[str, str]) -> int:
    text = path.read_text(encoding="utf-8")
    if not L10N_IMPORT.search(text):
        return 0
    new_text, tr_count = replace_tr_first_args(text, english_to_german)
    new_text, quote_count = replace_quoted_keys(new_text, english_to_german)
    count = tr_count + quote_count
    if count:
        path.write_text(new_text, encoding="utf-8")
    return count


def apply_catalogs(
    english_to_german: dict[str, str], german_to_english: dict[str, str]
) -> None:
    locales = {}
    for path in json_locales():
        locales[path.stem] = load_json(path)

    for lang, old in locales.items():
        rekeyed = rekey_locale(old, german_to_english)
        if lang == "de":
            rekeyed = {key: key for key in rekeyed}
        dump_json(JSON_DIR / f"{lang}.json", rekeyed)

    for strings_root in strings_dirs():
        for lproj in sorted(strings_root.glob("*.lproj")):
            strings_path = lproj / "Localizable.strings"
            if not strings_path.exists():
                continue
            lang = lproj.name.removesuffix(".lproj")
            old = parse_strings(strings_path.read_text(encoding="utf-8"))
            rekeyed = rekey_locale(old, german_to_english)
            if lang == "de":
                rekeyed = {key: key for key in rekeyed}
            dump_strings(strings_path, rekeyed)


def remaining_english_tr(files: list[Path], english_to_german: dict[str, str]) -> list[tuple[str, str]]:
    leftover: list[tuple[str, str]] = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        if not L10N_IMPORT.search(text):
            continue
        for match in TR_FIRST_STRING.finditer(text):
            key = unescape_literal(match.group("body"), match.group("q"))
            if key in english_to_german and english_to_german[key] != key:
                leftover.append((str(path.relative_to(MOBILE)), key))
    return leftover


def check(english_to_german: dict[str, str], german_to_english: dict[str, str]) -> int:
    errors: list[str] = []
    de = load_json(JSON_DIR / "de.json")
    en = load_json(JSON_DIR / "en.json")

    for key, value in de.items():
        if key != value:
            errors.append(f"de.json is not identity: {key!r} -> {value!r}")

    for german, english in german_to_english.items():
        if german not in de:
            errors.append(f"missing German key in de.json: {german!r}")
        if german not in en:
            errors.append(f"missing German key in en.json: {german!r}")
        elif en[german] != english and english_to_german.get(en[german]) != german:
            # Merged keys may store the preferred English, which can differ from
            # a collapsed sibling. That is expected. Flag only if English is gone.
            if en[german] not in english_to_german:
                errors.append(f"en.json[{german!r}]={en[german]!r} is not a known English key")

    files = iter_source_files()
    leftover = remaining_english_tr(files, english_to_german)
    for rel, key in leftover:
        errors.append(f"tr() still uses English key {key!r} in {rel}")

    config = json.loads((ROOT / "stryngz.config.json").read_text(encoding="utf-8"))
    if config.get("sourceLanguage") != "de":
        errors.append("stryngz.config.json sourceLanguage is not de")
    if "de" in config.get("targetLanguages", []):
        errors.append("de is still a target language")
    if "en" not in config.get("targetLanguages", []):
        errors.append("en is missing from targetLanguages")
    source_path = config.get("source", {}).get("path", "")
    if not source_path.endswith("de.json"):
        errors.append(f"source.path is not de.json: {source_path}")
    prompt = config.get("refiner", {}).get("systemPrompt", "")
    if "Swiss Standard German" not in prompt or "source language" not in prompt.lower():
        errors.append("systemPrompt does not treat Swiss German as the source")

    pkg = (ROOT / "ios" / "Package.swift").read_text(encoding="utf-8")
    if 'defaultLocalization: "en"' not in pkg:
        errors.append("Package.swift defaultLocalization is not en")

    rn = (ROOT / "reactnative" / "src" / "index.ts").read_text(encoding="utf-8")
    if 'const DEFAULT_LOCALE: SupportedLanguage = "en"' not in rn:
        errors.append("RN DEFAULT_LOCALE is not en")
    if "english-to-german" in rn or "englishToGerman" in rn:
        errors.append("RN tr() still loads english-to-german")

    ios_tr = (ROOT / "ios" / "Sources" / "CasaZurigol10n" / "CasaZurigol10n.swift").read_text(
        encoding="utf-8"
    )
    if "self = .en" not in ios_tr.split("default:")[-1][:80]:
        errors.append("iOS Language default is not en")
    if "return .en" not in ios_tr:
        errors.append("iOS appLanguage fallback is not en")

    recycling = (
        MOBILE
        / "ios/Packages/CasaZurigoUI/Sources/CasaZurigoUI/Views/RecyclingDetailView.swift"
    )
    recycling_src = recycling.read_text(encoding="utf-8")
    if 'Image("Cardboard"' not in recycling_src or 'Image("Mobile"' not in recycling_src:
        errors.append("RecyclingDetailView lost English asset names")

    if en.get("Startseite") != "Home":
        errors.append("en.json Startseite is not Home")
    if en.get("vor %@ Tagen") != "%@ days ago":
        errors.append("en.json time plural is wrong")
    if de.get("Startseite") != "Startseite":
        errors.append("de.json Startseite is not identity")
    if (JSON_DIR / "english-to-german.json").exists():
        errors.append("english-to-german.json should not be shipped")

    if errors:
        print("CHECK FAIL")
        for err in errors:
            print(f"  {err}")
        return 1
    print("CHECK PASS")
    print(f"  de keys {len(de)}")
    print(f"  en keys {len(en)}")
    print(f"  english-to-german {len(english_to_german)}")
    return 0


def report(
    de: dict[str, str],
    used: dict[str, list[str]],
    english_to_german: dict[str, str],
    notes: list[str],
) -> None:
    missing = sorted(k for k in used if k not in de and k not in english_to_german)
    print(f"catalog keys {len(de)}")
    print(f"unique tr() literals {len(used)}")
    print(f"mapped {len(english_to_german)}")
    print(f"merge notes {len(notes)}")
    for note in notes:
        print(f"  {note}")
    print(f"tr() keys missing from catalog {len(missing)}")
    for key in missing[:50]:
        print(f"  missing {key!r} in {used[key][0]}")
    unused = sorted(k for k in de if k not in used)
    print(f"catalog keys with no tr() literal {len(unused)}")


def mapping_from_en() -> tuple[dict[str, str], dict[str, str]]:
    en = load_json(JSON_DIR / "en.json")
    german_to_english = dict(en)
    english_to_german = {english: german for german, english in en.items()}
    for german in en:
        english_to_german.setdefault(german, german)
    return english_to_german, german_to_english


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--rewrite-sources", action="store_true")
    args = parser.parse_args()

    files = iter_source_files()
    used_map = collect_tr_literals(files)
    used_keys = set(used_map)
    de = load_json(JSON_DIR / "de.json")
    if (args.check or args.rewrite_sources) and not args.apply:
        english_to_german, german_to_english = mapping_from_en()
        notes: list[str] = []
    else:
        english_to_german, german_to_english, notes = build_mapping(de, used_keys)

    if args.check and not args.apply and not args.rewrite_sources:
        return check(english_to_german, german_to_english)

    if args.rewrite_sources:
        replacements = 0
        for path in files:
            replacements += rewrite_source_file(path, english_to_german)
        print(f"rewrote sources with {replacements} replacements")
        return check(english_to_german, german_to_english)

    report(de, used_map, english_to_german, notes)
    if not args.apply:
        print("dry-run; pass --apply to write")
        return 0

    apply_catalogs(english_to_german, german_to_english)
    replacements = 0
    for path in files:
        replacements += rewrite_source_file(path, english_to_german)
    print(f"wrote catalogs and {replacements} quoted replacements")
    return check(english_to_german, german_to_english)


if __name__ == "__main__":
    sys.exit(main())
