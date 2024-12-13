import json
import re
from pathlib import Path
from abc import ABC, abstractmethod

class BaseFileHandler(ABC):
    @abstractmethod
    def parse_file(self, file_path):
        pass

    @abstractmethod
    def create_file(self, translations, output_path):
        pass

    def _lowercase_keys(self, translations):
        """Helper method to convert all keys to lowercase"""
        return {k.lower(): v for k, v in translations.items()}

class StringsFileHandler(BaseFileHandler):
    def parse_file(self, file_path):
        translations = {}
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                matches = re.findall(r'"([^"]+)"\s*=\s*"([^"]+)";', content)
                translations = {key: value for key, value in matches}
        except FileNotFoundError as e:
            print(f"Error reading file '{file_path}': {str(e)}")
        return translations

    def create_file(self, translations, output_path):
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            for key, value in sorted(translations.items()):
                f.write(f'"{key}" = "{value}";\n')

class JsonFileHandler(BaseFileHandler):
    def parse_file(self, file_path):
        translations = {}
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                translations = json.load(f)
        except FileNotFoundError as e:
            print(f"Error reading file '{file_path}': {str(e)}")
        return translations

    def create_file(self, translations, output_path):
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(dict(sorted(translations.items())), f, ensure_ascii=False, indent=2)

class FileHandlerFactory:
    @staticmethod
    def get_handler(file_path):
        file_extension = Path(file_path).suffix.lower()
        if file_extension == '.strings':
            return StringsFileHandler()
        elif file_extension == '.json':
            return JsonFileHandler()
        else:
            raise ValueError(f"Unsupported file extension: {file_extension}")