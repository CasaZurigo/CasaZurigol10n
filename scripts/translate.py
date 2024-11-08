import re
from deep_translator import DeeplTranslator
import time
from pathlib import Path
import argparse


class StringsTranslator:
    def __init__(self, auth_key, source_lang):
        self.translator = DeeplTranslator(api_key=auth_key, source=source_lang.lower())
        self.cache = {}

    def parse_strings_file(self, file_path):
        translations = {}
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                matches = re.findall(r'"([^"]+)"\s*=\s*"([^"]+)";', content)
                for key, value in matches:
                    translations[key] = value
        except FileNotFoundError as e:
            pass
        return translations

    def create_strings_file(self, translations, output_path):
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            for key, value in translations.items():
                f.write(f'"{key}" = "{value}";\n')

    def translate_strings(self, source_translations, target_translations, target_language):
        translated = target_translations.copy()
        missing_translations = {
            key: value for key, value in source_translations.items() 
            if key not in target_translations
        }

        if missing_translations:
            print(f"Translating {len(missing_translations)} missing strings to {target_language}...")
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

                        # Add delay to respect API rate limits
                        time.sleep(0.5)

                    except Exception as e:
                        print(f"Error translating '{key}': {str(e)}")
                        translated[key] = value  # Use original value on error

                print(f"Progress: {i}/{total} ({int(i/total*100)}%)")
        else:
            print(f"No new strings to translate for {target_language}")
        return translated

    def translate_to_languages(
        self, source_file, target_languages, output_dir="translations"
    ):

        source_translations = self.parse_strings_file(source_file)
        totalStrings = len(source_translations)
        totalChars = sum(len(value) for value in source_translations.values())
        print(f"Source file: {source_file}")
        print(f"Total strings: {totalStrings}")
        print(f"Total characters: {totalChars}")

        print(
            f"Will translate {totalStrings * len(target_languages)} strings & {totalChars * len(target_languages)} characters"
        )

        for lang in target_languages:
            print(f"\nProcessing {lang}...")
            output_file = Path(output_dir, lang.lower()) / "Localizable.strings"
            
            # Check if target file exists and parse it
            target_translations = self.parse_strings_file(output_file)
            
            # Translate only missing strings
            translated = self.translate_strings(source_translations, target_translations, lang)
            
            # Create or update the target file
            self.create_strings_file(translated, output_file)
            print(f"Created/Updated {output_file}")


# Usage
if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Translate .strings files using DeepL")

    parser.add_argument(
        "--auth-key", required=True, help="DeepL API authentication key"
    )

    parser.add_argument(
        "--input-file", required=True, help="Path to source .strings file"
    )

    parser.add_argument(
        "--source-lang", default="EN", help="Source language code (default: EN)"
    )

    parser.add_argument(
        "--target-langs",
        required=True,
        nargs="+",
        help="List of target language codes (e.g., FR IT DE)",
    )

    parser.add_argument(
        "--output-dir",
        default="translations",
        help="Output directory for translated files (default: translations)",
    )

    # Parse arguments
    args = parser.parse_args()

    # Create translator instance and process translations
    translator = StringsTranslator(args.auth_key, args.source_lang)
    translator.translate_to_languages(
        source_file=args.input_file,
        target_languages=args.target_langs,
        output_dir=args.output_dir,
    )
