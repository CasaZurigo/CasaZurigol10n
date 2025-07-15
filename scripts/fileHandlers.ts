import fs from "fs";
import path from "path";

export interface FileHandler {
  parseFile(filePath: string): Record<string, string>;
  createFile(translations: Record<string, string>, outputPath: string): void;
}

export interface XCStringsFileHandler extends FileHandler {
  updateFile(
    filePath: string,
    key: string,
    newValue: string,
    language: string,
  ): void;
  deleteEntry(filePath: string, key: string): void;
  renameEntry(filePath: string, oldKey: string, newKey: string): void;
  syncWithTranslations(
    filePath: string,
    allLanguageTranslations: Record<string, Record<string, string>>,
  ): void;
}

export class StringsFileHandler implements FileHandler {
  parseFile(filePath: string): Record<string, string> {
    const translations: Record<string, string> = {};
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const matches = content.match(/"([^"]+)"\s*=\s*"([^"]+)";/g) || [];
      matches.forEach((match) => {
        const [key, value] = match
          .match(/"([^"]+)"/g)!
          .map((s) => s.slice(1, -1));
        translations[key] = value;
      });
    } catch (e) {
      console.error(`Error reading file '${filePath}': ${e}`);
    }
    return translations;
  }

  createFile(translations: Record<string, string>, outputPath: string): void {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const orderedContent = Object.entries(translations).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const content = orderedContent
      .map(([key, value]) => `"${key}" = "${value}";`)
      .join("\n");
    fs.writeFileSync(outputPath, content, "utf-8");
  }
}

export class JsonFileHandler implements FileHandler {
  parseFile(filePath: string): Record<string, string> {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {
      console.error(`Error reading file '${filePath}': ${e}`);
      return {};
    }
  }

  createFile(translations: Record<string, string>, outputPath: string): void {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const orderedContent = Object.keys(translations)
      .sort(([a], [b]) => a.localeCompare(b)) // Sort the keys alphabetically
      .reduce(
        (obj, key) => {
          obj[key] = translations[key]; // Rebuild the object with sorted keys
          return obj;
        },
        {} as Record<string, string>,
      );

    fs.writeFileSync(
      outputPath,
      JSON.stringify(orderedContent, null, 2),
      "utf-8",
    );
  }
}

interface XCStringsData {
  sourceLanguage: string;
  strings: Record<
    string,
    {
      extractionState?: string;
      localizations: Record<
        string,
        {
          stringUnit: {
            state: string;
            value: string;
          };
        }
      >;
    }
  >;
  version: string;
}

export class XCStringsFileHandlerImpl implements XCStringsFileHandler {
  private readonly supportedLanguages = [
    "de",
    "fr",
    "en",
    "it",
    "es",
    "pt-PT",
    "tr",
  ];
  private readonly sourceLanguage = "en";

  parseFile(filePath: string): Record<string, string> {
    try {
      if (!fs.existsSync(filePath)) {
        return {};
      }
      const content = fs.readFileSync(filePath, "utf-8");
      const data: XCStringsData = JSON.parse(content);

      const translations: Record<string, string> = {};
      for (const [key, stringData] of Object.entries(data.strings)) {
        const sourceLocalization =
          stringData.localizations[this.sourceLanguage];
        if (sourceLocalization) {
          translations[key] = sourceLocalization.stringUnit.value;
        }
      }
      return translations;
    } catch (e) {
      console.error(`Error reading .xcstrings file '${filePath}': ${e}`);
      return {};
    }
  }

  createFile(translations: Record<string, string>, outputPath: string): void {
    const data: XCStringsData = {
      sourceLanguage: this.sourceLanguage,
      strings: {},
      version: "1.0",
    };

    for (const [key, value] of Object.entries(translations)) {
      data.strings[key] = {
        localizations: {
          [this.sourceLanguage]: {
            stringUnit: {
              state: "translated",
              value: value,
            },
          },
        },
      };
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");
  }

  updateFile(
    filePath: string,
    key: string,
    newValue: string,
    language: string,
  ): void {
    try {
      const data: XCStringsData = this.readXCStringsFile(filePath);

      if (!data.strings[key]) {
        data.strings[key] = {
          localizations: {},
        };
      }

      data.strings[key].localizations[language] = {
        stringUnit: {
          state: "translated",
          value: newValue,
        },
      };

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error(`Error updating .xcstrings file '${filePath}': ${e}`);
    }
  }

  deleteEntry(filePath: string, key: string): void {
    try {
      const data: XCStringsData = this.readXCStringsFile(filePath);

      if (data.strings[key]) {
        delete data.strings[key];
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      }
    } catch (e) {
      console.error(
        `Error deleting entry from .xcstrings file '${filePath}': ${e}`,
      );
    }
  }

  renameEntry(filePath: string, oldKey: string, newKey: string): void {
    try {
      const data: XCStringsData = this.readXCStringsFile(filePath);

      if (data.strings[oldKey]) {
        data.strings[newKey] = data.strings[oldKey];
        delete data.strings[oldKey];
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      }
    } catch (e) {
      console.error(
        `Error renaming entry in .xcstrings file '${filePath}': ${e}`,
      );
    }
  }

  syncWithTranslations(
    filePath: string,
    allLanguageTranslations: Record<string, Record<string, string>>,
  ): void {
    try {
      const data: XCStringsData = this.readXCStringsFile(filePath);

      const sourceTranslations =
        allLanguageTranslations[this.sourceLanguage] || {};

      for (const [key, value] of Object.entries(sourceTranslations)) {
        if (!data.strings[key]) {
          data.strings[key] = {
            localizations: {},
          };
        }

        for (const language of this.supportedLanguages) {
          const langTranslations = allLanguageTranslations[language];
          if (langTranslations && langTranslations[key]) {
            data.strings[key].localizations[language] = {
              stringUnit: {
                state: "translated",
                value: langTranslations[key],
              },
            };
          }
        }
      }

      const existingKeys = new Set(Object.keys(sourceTranslations));
      for (const key of Object.keys(data.strings)) {
        if (!existingKeys.has(key)) {
          delete data.strings[key];
        }
      }

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error(`Error syncing .xcstrings file '${filePath}': ${e}`);
    }
  }

  private readXCStringsFile(filePath: string): XCStringsData {
    if (!fs.existsSync(filePath)) {
      return {
        sourceLanguage: this.sourceLanguage,
        strings: {},
        version: "1.0",
      };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  }
}

export class FileHandlerFactory {
  private static stringsFileHandler = new StringsFileHandler();
  private static jsonFileHandler = new JsonFileHandler();
  private static xcstringsFileHandler = new XCStringsFileHandlerImpl();

  static getHandler(filePath: string): FileHandler {
    const extension = path.extname(filePath).toLowerCase();
    switch (extension) {
      case ".strings":
        return this.stringsFileHandler;
      case ".json":
        return this.jsonFileHandler;
      case ".xcstrings":
        return this.xcstringsFileHandler;
      default:
        throw new Error(`Unsupported file extension: ${extension}`);
    }
  }

  static getStringsFileHandler(): FileHandler {
    return this.stringsFileHandler;
  }

  static getJsonFileHandler(): FileHandler {
    return this.jsonFileHandler;
  }

  static getXCStringsFileHandler(): XCStringsFileHandler {
    return this.xcstringsFileHandler;
  }
}
