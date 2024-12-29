import re
from deep_translator import DeeplTranslator
import time
from pathlib import Path
import argparse
from dotenv import load_dotenv
import os
from file_handlers import FileHandlerFactory
from file_handlers import StringsFileHandler
from file_handlers import JsonFileHandler

load_dotenv()

class StringsTranslator:
    def __init__(self, auth_key, source_lang):
        self.translator = DeeplTranslator(api_key=auth_key, source=source_lang.lower())
        self.cache = {}
        self.strings_handler = StringsFileHandler()
        self.json_handler = JsonFileHandler()

    def is_info_plist(self, file_path):
        return "InfoPlist" in Path(file_path).stem
    def is_app_shortcuts(self, file_path):
        return "AppShortcuts" in Path(file_path).stem

    def translate_strings(
        self, source_translations, target_translations, target_language, should_serialize_keys
    ):
        translated = target_translations.copy()
        
        if should_serialize_keys:
            source_translations = {k.lower(): v for k, v in source_translations.items()}
            missing_translations = {
                key.lower(): value
                for key, value in source_translations.items()
                if key.lower() not in {k.lower() for k in target_translations.keys()}
            }
        else:
            missing_translations = {
                key: value
                for key, value in source_translations.items()
                if key not in target_translations
            }

        if missing_translations:
            print(
                f"Translating {len(missing_translations)} missing strings to {target_language}..."
            )
            total = len(missing_translations)
            for i, (key, value) in enumerate(missing_translations.items(), 1):
                cache_key = f"{value}:{target_language}"
                if cache_key in self.cache:
                    translated[key] = self.cache[cache_key]
                else:
                    try:
                        self.translator.target = target_language.lower()
                        result = self.translator.translate(value)
                        translated[key] = result
                        self.cache[cache_key] = result
                        time.sleep(0.5)
                    except Exception as e:
                        print(f"Error translating '{key}': {str(e)}")
                        translated[key] = value
                print(f"Progress: {i}/{total} ({int(i/total*100)}%)")
        else:
            print(f"No new strings to translate for {target_language}")
        return translated

    def translate_to_languages(
        self, input_files, target_languages, output_dir="translations"
    ):
        for input_file in input_files:
            is_infoplist = self.is_info_plist(input_file)
            is_appShortcuts = self.is_app_shortcuts(input_file)
            handler = FileHandlerFactory.get_handler(input_file)
            source_translations = handler.parse_file(input_file)

            input_filename = Path(input_file).name
            input_stem = Path(input_file).stem

            totalStrings = len(source_translations)
            totalChars = sum(len(value) for value in source_translations.values())

            # Get the filename from the input path
            input_filename = Path(input_file).name

            print(f"\nProcessing source file: {input_file}")
            print(f"Total strings: {totalStrings}")
            print(f"Total characters: {totalChars}")
            print(
                f"Will translate {totalStrings * len(target_languages)} strings & {totalChars * len(target_languages)} characters"
            )

            for lang in target_languages:
                print(f"\nProcessing {lang} for {input_filename}...")

                # Determine output file extension (same as input)
                strings_output_file = Path(output_dir, f"{lang}.lproj") / f"{input_stem}.strings"
                json_output_file = Path(output_dir, f"{lang}.lproj") / f"{input_stem}.json"

                # Get handler for the output file (same as input handler)

                existing_strings_translations = {}
                existing_json_translations = {}

                if strings_output_file.exists():
                    existing_strings_translations = self.strings_handler.parse_file(strings_output_file)
                if json_output_file.exists():
                    existing_json_translations = self.json_handler.parse_file(json_output_file)
                
                existing_translations = {**existing_json_translations, **existing_strings_translations}

                should_serialize_keys = not (is_infoplist or is_appShortcuts)
                
                # Translate only missing strings
                translated = self.translate_strings(
                    source_translations, existing_translations, lang, should_serialize_keys
                )

                # Create or update the target file
                self.strings_handler.create_file(translated, strings_output_file)
                self.json_handler.create_file(translated, json_output_file)
                print(f"Created/Updated {strings_output_file}")
                print(f"Created/Updated {json_output_file}")


# Usage
if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Translate .strings files using DeepL")
    parser.add_argument(
        "--auth-key",
        default=os.getenv("DEEPL_AUTH_KEY"),
        help="DeepL API authentication key",
    )
    parser.add_argument(
        "--source-lang",
        default=os.getenv("SOURCE_LANG", "en"),
        help="Source language code (default: en)",
    )
    parser.add_argument(
        "--target-langs",
        nargs="+",
        default=os.getenv("TARGET_LANG", "fr,it,es,pt-PT,tr,de,en").split(","),
        help="List of target language codes (e.g., fr it de)",
    )
    parser.add_argument(
        "--output-dir",
        default=os.getenv("OUTPUT_DIR", "./Sources/CasaZurigol10n/Resources"),
        help="Output directory for translated files (default: ./Sources/CasaZurigol10n/Resources)",
    )

    # Parse arguments
    args = parser.parse_args()

    if not args.auth_key:
        raise ValueError(
            "DeepL authentication key is required. Provide it via --auth-key or DEEPL_AUTH_KEY environment variable"
        )

    if not args.target_langs:
        raise ValueError(
            "Target languages are required. Provide them via --target-langs or TARGET_LANGS environment variable"
        )

    input_files = f"./Sources/CasaZurigol10n/Resources/{args.source_lang}.lproj/Localizable.strings,./Sources/CasaZurigol10n/Resources/{args.source_lang}.lproj/InfoPlist.strings,./Sources/CasaZurigol10n/Resources/{args.source_lang}.lproj/AppShortcuts.strings".split(",")

    # Create translator instance and process translations
    translator = StringsTranslator(args.auth_key, args.source_lang)
    translator.translate_to_languages(
        input_files=input_files,
        target_languages=args.target_langs,
        output_dir=args.output_dir,
    )
