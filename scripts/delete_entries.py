# scripts/delete_entries.py
from pathlib import Path
import argparse
from file_handlers import StringsFileHandler, JsonFileHandler

class StringsEditor:
    def __init__(self):
        self.strings_handler = StringsFileHandler()
        self.json_handler = JsonFileHandler()
        self.base_path = Path("./Sources/CasaZurigol10n/Resources")

    def delete_entry(self, file_path, key_to_delete):
        """Delete entry from a file (.strings or .json)"""
        path = Path(file_path)
        handler = self.strings_handler if path.suffix == '.strings' else self.json_handler
        
        if path.exists() and path.is_file():
            translations = handler.parse_file(path)
            if key_to_delete.lower() in translations:
                del translations[key_to_delete.lower()]
                handler.create_file(translations, path)
                print(f"Deleted key '{key_to_delete}' from {path}")
                return True
        return False

    def delete_entry_from_all_files(self, key_to_delete):
        """Delete entry from all .strings and .json files in the Resources directory"""
        deletions_count = 0
        
        # Find and process all .strings and .json files
        for file_path in self.base_path.rglob("*"):
            if file_path.suffix in ['.strings', '.json']:
                if self.delete_entry(file_path, key_to_delete):
                    deletions_count += 1
        
        return deletions_count

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Delete entries from localization files")
    parser.add_argument(
        "--key",
        required=True,
        help="The key to delete from all files"
    )

    args = parser.parse_args()
    editor = StringsEditor()
    deletions = editor.delete_entry_from_all_files(args.key)
    print(f"\nTotal deletions performed: {deletions}")