# scripts/delete_entries.py
from pathlib import Path
import argparse
from dotenv import load_dotenv
import os
from strings_handler import StringsHandler

load_dotenv()

class StringsEditor(StringsHandler):
    def delete_entry(self, file_path, key_to_delete):
        if not Path(file_path).exists():
            print(f"File not found: {file_path}")
            return False
        
        translations = StringsHandler.parse_strings_file(file_path)
        if key_to_delete in translations:
            del translations[key_to_delete]
            StringsHandler.create_strings_file(translations, file_path)
            return True
        return False

    def delete_entry_from_files(self, input_files, target_languages, output_dir, key_to_delete):
        deletions_count = 0
        
        # Delete from input files
        for input_file in input_files:
            if self.delete_entry(input_file, key_to_delete):
                print(f"Deleted key '{key_to_delete}' from {input_file}")
                deletions_count += 1

        # Delete from output files
        for lang in target_languages:
            for input_file in input_files:
                input_filename = Path(input_file).name
                output_file = Path(output_dir, f"{lang}.lproj") / input_filename
                if self.delete_entry(output_file, key_to_delete):
                    print(f"Deleted key '{key_to_delete}' from {output_file}")
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