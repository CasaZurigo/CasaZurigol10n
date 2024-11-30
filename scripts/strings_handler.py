import re
from pathlib import Path

class StringsHandler:
    @staticmethod
    def parse_strings_file(file_path):
        translations = {}
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                matches = re.findall(r'"([^"]+)"\s*=\s*"([^"]+)";', content)
                for key, value in matches:
                    translations[key] = value
        except FileNotFoundError as e:
            print(f"Error reading file '{file_path}': {str(e)}")
        return translations

    @staticmethod
    def create_strings_file(translations, output_path):
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            for key, value in translations.items():
                f.write(f'"{key}" = "{value}";\n')