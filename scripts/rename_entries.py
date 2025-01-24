# scripts/rename_keys.py
from pathlib import Path
import argparse
from file_handlers import StringsFileHandler, JsonFileHandler

class StringsEditor:
    def __init__(self):
        self.strings_handler = StringsFileHandler()
        self.json_handler = JsonFileHandler()
        self.base_path = Path("./Sources/CasaZurigol10n/Resources")

    def rename_key(self, file_path, old_key, new_key):
        """Rename key in a file (.strings or .json)"""
        path = Path(file_path)
        handler = self.strings_handler if path.suffix == '.strings' else self.json_handler
        
        if path.exists() and path.is_file():
            translations = handler.parse_file(path)
            old_key = old_key.lower()
            new_key = new_key.lower()
            
            if old_key in translations:
                value = translations[old_key]
                del translations[old_key]
                translations[new_key] = value
                handler.create_file(translations, path)
                print(f"Renamed key '{old_key}' to '{new_key}' in {path}")
                return True
        return False

    def rename_key_in_all_files(self, old_key, new_key):
        """Rename key in all .strings and .json files in the Resources directory"""
        rename_count = 0
        
        # Find and process all .strings and .json files
        for file_path in self.base_path.rglob("*"):
            if file_path.suffix in ['.strings', '.json']:
                if self.rename_key(file_path, old_key, new_key):
                    rename_count += 1
        
        return rename_count

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rename keys in localization files")
    parser.add_argument(
        "--old-key",
        required=True,
        help="The key to be renamed"
    )
    parser.add_argument(
        "--new-key",
        required=True,
        help="The new name for the key"
    )

    args = parser.parse_args()
    editor = StringsEditor()
    renames = editor.rename_key_in_all_files(args.old_key, args.new_key)
    print(f"\nTotal renames performed: {renames}")