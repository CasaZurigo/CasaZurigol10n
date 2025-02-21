import fs from "fs";
import path from "path";

export interface FileHandler {
  parseFile(filePath: string): Record<string, string>;
  createFile(translations: Record<string, string>, outputPath: string): void;
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
      a.localeCompare(b)
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
      .reduce((obj, key) => {
        obj[key] = translations[key]; // Rebuild the object with sorted keys
        return obj;
      }, {} as Record<string, string>);

    fs.writeFileSync(
      outputPath,
      JSON.stringify(orderedContent, null, 2),
      "utf-8"
    );
  }
}

export class FileHandlerFactory {
  private static stringsFileHandler = new StringsFileHandler();
  private static jsonFileHandler = new JsonFileHandler();

  static getHandler(filePath: string): FileHandler {
    const extension = path.extname(filePath).toLowerCase();
    switch (extension) {
      case ".strings":
        return this.stringsFileHandler;
      case ".json":
        return this.jsonFileHandler;
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
}
