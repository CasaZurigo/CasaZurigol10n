# scripts/delete_entries.py
from pathlib import Path
import argparse
from dotenv import load_dotenv
import os
from file_handlers import FileHandlerFactory
from file_handlers import JsonFileHandler
from file_handlers import StringsFileHandler

load_dotenv()

class StringsEditor:
    def __init__(self):
        self.strings_handler = StringsFileHandler()
        self.json_handler = JsonFileHandler()

    def delete_entry(self, file_path, key_to_delete):
        """Delete entry from both .strings and .json files"""
        strings_path = Path(file_path)
        json_path = strings_path.with_suffix('.json')
        key_to_delete = key_to_delete.lower()
        success = False

        # Delete from .strings file
        if strings_path.exists() and strings_path.is_file():
            translations = self.strings_handler.parse_file(strings_path)
            if key_to_delete in translations:
                del translations[key_to_delete]
                self.strings_handler.create_file(translations, strings_path)
                success = True
                print(f"Deleted key '{key_to_delete}' from {strings_path}")

        # Delete from .json file
        if json_path.exists() and json_path.is_file():
            translations = self.json_handler.parse_file(json_path)
            if key_to_delete in translations:
                del translations[key_to_delete]
                self.json_handler.create_file(translations, json_path)
                success = True
                print(f"Deleted key '{key_to_delete}' from {json_path}")

        if not success:
            print(f"Key '{key_to_delete}' not found in {strings_path} or {json_path}")

        return success

    def delete_entry_from_files(self, input_files, target_languages, output_dir, key_to_delete):
        deletions_count = 0

        # Delete from input files
        for input_file in input_files:
            if self.delete_entry(input_file, key_to_delete):
                deletions_count += 1

        # Delete from output files for each target language
        for lang in target_languages:
            for input_file in input_files:
                input_stem = Path(input_file).stem
                strings_output = Path(output_dir, f"{lang}.lproj") / f"{input_stem}.strings"
                if self.delete_entry(strings_output, key_to_delete):
                    deletions_count += 1

        return deletions_count

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Delete entries from .strings files")
    parser.add_argument(
        "--input-files",
        nargs="+",
        default=os.getenv(
            "INPUT_FILES",
            "./Sources/CasaZurigol10n/Resources/en.lproj/Localizable.strings,./Sources/CasaZurigol10n/Resources/en.lproj/InfoPlist.strings",
        ).split(","),
        help="Paths to source .strings files",
    )
    parser.add_argument(
        "--target-langs",
        nargs="+",
        default=os.getenv("TARGET_LANG", "fr,it,es,pt-PT,tr,de").split(","),
        help="List of target language codes",
    )
    parser.add_argument(
        "--output-dir",
        default=os.getenv("OUTPUT_DIR", "./Sources/CasaZurigol10n/Resources"),
        help="Output directory for translated files",
    )
    parser.add_argument(
        "--key",
        required=True,
        help="The key to delete from all files",
    )

    args = parser.parse_args()

    editor = StringsEditor()
    deletions = editor.delete_entry_from_files(
        input_files=args.input_files,
        target_languages=args.target_langs,
        output_dir=args.output_dir,
        key_to_delete=args.key
    )

    print(f"\nTotal deletions performed: {deletions}")