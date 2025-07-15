import * as fs from "fs";
import * as path from "path";
import {
  KeyMapping,
  FileProcessingResult,
  StringsFileEntry,
  MigrationConfig,
} from "./types";
import { KeyTransformer } from "./keyTransformer";

/**
 * Processes different file types during migration
 */
export class FileProcessor {
  /**
   * Process a .strings file with new key mappings
   */
  static async processStringsFile(
    filePath: string,
    keyMappings: KeyMapping[],
    config: MigrationConfig,
  ): Promise<FileProcessingResult> {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          filePath,
          error: "File does not exist",
          keysProcessed: 0,
        };
      }

      const content = fs.readFileSync(filePath, "utf8");
      const entries = this.parseStringsFile(content);
      const mappingMap = new Map(keyMappings.map((m) => [m.oldKey, m]));

      let processedContent = "";
      let keysProcessed = 0;

      for (const entry of entries) {
        const mapping = mappingMap.get(entry.key);
        if (mapping) {
          const escapedKey = KeyTransformer.escapeForStrings(mapping.newKey);
          const escapedValue = KeyTransformer.escapeForStrings(entry.value);
          processedContent += `"${escapedKey}" = "${escapedValue}";\n`;
          keysProcessed++;
        } else {
          // Keep original entry if no mapping found
          const escapedKey = KeyTransformer.escapeForStrings(entry.key);
          const escapedValue = KeyTransformer.escapeForStrings(entry.value);
          processedContent += `"${escapedKey}" = "${escapedValue}";\n`;
        }
      }

      if (!config.dryRun) {
        fs.writeFileSync(filePath, processedContent, "utf8");
      }

      return {
        success: true,
        filePath,
        keysProcessed,
      };
    } catch (error) {
      return {
        success: false,
        filePath,
        error: String(error),
        keysProcessed: 0,
      };
    }
  }

  /**
   * Process a .json file with new key mappings
   */
  static async processJSONFile(
    filePath: string,
    keyMappings: KeyMapping[],
    config: MigrationConfig,
  ): Promise<FileProcessingResult> {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          filePath,
          error: "File does not exist",
          keysProcessed: 0,
        };
      }

      const content = fs.readFileSync(filePath, "utf8");
      const jsonData = JSON.parse(content);
      const mappingMap = new Map(keyMappings.map((m) => [m.oldKey, m]));

      const processedData: Record<string, string> = {};
      let keysProcessed = 0;

      for (const [key, value] of Object.entries(jsonData)) {
        const mapping = mappingMap.get(key);
        if (mapping) {
          processedData[mapping.newKey] = value as string;
          keysProcessed++;
        } else {
          // Keep original entry if no mapping found
          processedData[key] = value as string;
        }
      }

      if (!config.dryRun) {
        fs.writeFileSync(
          filePath,
          JSON.stringify(processedData, null, 2),
          "utf8",
        );
      }

      return {
        success: true,
        filePath,
        keysProcessed,
      };
    } catch (error) {
      return {
        success: false,
        filePath,
        error: String(error),
        keysProcessed: 0,
      };
    }
  }

  /**
   * Process a .xcstrings file with new key mappings
   */
  static async processXCStringsFile(
    filePath: string,
    keyMappings: KeyMapping[],
    config: MigrationConfig,
  ): Promise<FileProcessingResult> {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          filePath,
          error: "File does not exist",
          keysProcessed: 0,
        };
      }

      const content = fs.readFileSync(filePath, "utf8");
      const xcstringsData = JSON.parse(content);
      const mappingMap = new Map(keyMappings.map((m) => [m.oldKey, m]));

      const processedStrings: Record<string, any> = {};
      let keysProcessed = 0;

      for (const [key, entry] of Object.entries(xcstringsData.strings)) {
        const mapping = mappingMap.get(key);
        if (mapping) {
          processedStrings[mapping.newKey] = entry;
          keysProcessed++;
        } else {
          // Keep original entry if no mapping found
          processedStrings[key] = entry;
        }
      }

      const processedData = {
        ...xcstringsData,
        strings: processedStrings,
      };

      if (!config.dryRun) {
        fs.writeFileSync(
          filePath,
          JSON.stringify(processedData, null, 2),
          "utf8",
        );
      }

      return {
        success: true,
        filePath,
        keysProcessed,
      };
    } catch (error) {
      return {
        success: false,
        filePath,
        error: String(error),
        keysProcessed: 0,
      };
    }
  }

  /**
   * Process all files for a specific language
   */
  static async processLanguageFiles(
    projectRoot: string,
    language: string,
    keyMappings: KeyMapping[],
    config: MigrationConfig,
  ): Promise<FileProcessingResult[]> {
    const results: FileProcessingResult[] = [];
    const basePath = path.join(projectRoot, "Sources/CasaZurigol10n/Resources");
    const langPath = path.join(basePath, `${language}.lproj`);

    // Process .strings files
    const stringsFiles = [
      "Localizable.strings",
      "InfoPlist.strings",
      "AppShortcuts.strings",
    ];
    for (const file of stringsFiles) {
      const filePath = path.join(langPath, file);
      const result = await this.processStringsFile(
        filePath,
        keyMappings,
        config,
      );
      results.push(result);
    }

    // Process .json files
    const jsonFiles = [
      "Localizable.json",
      "InfoPlist.json",
      "AppShortcuts.json",
    ];
    for (const file of jsonFiles) {
      const filePath = path.join(langPath, file);
      const result = await this.processJSONFile(filePath, keyMappings, config);
      results.push(result);
    }

    return results;
  }

  /**
   * Process all XCStrings files
   */
  static async processXCStringsFiles(
    projectRoot: string,
    keyMappings: KeyMapping[],
    config: MigrationConfig,
  ): Promise<FileProcessingResult[]> {
    const results: FileProcessingResult[] = [];
    const basePath = path.join(projectRoot, "Sources/CasaZurigol10n/Resources");
    const xcstringsFiles = [
      "Localizable.xcstrings",
      "InfoPlist.xcstrings",
      "AppShortcuts.xcstrings",
    ];

    for (const file of xcstringsFiles) {
      const filePath = path.join(basePath, file);
      const result = await this.processXCStringsFile(
        filePath,
        keyMappings,
        config,
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Parse .strings file content
   */
  private static parseStringsFile(content: string): StringsFileEntry[] {
    const entries: StringsFileEntry[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (!line || line.startsWith("//") || line.startsWith("/*")) {
        continue;
      }

      // Parse key-value pairs
      const match = line.match(
        /^"([^"]+)"\s*=\s*"([^"]*(?:\\.[^"]*)*)"\s*;?\s*$/,
      );
      if (match) {
        entries.push({
          key: match[1],
          value: match[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
        });
      }
    }

    return entries;
  }

  /**
   * Get all file paths that will be processed
   */
  static getProcessingFilePaths(
    projectRoot: string,
    config: MigrationConfig,
  ): string[] {
    const paths: string[] = [];
    const basePath = path.join(projectRoot, "Sources/CasaZurigol10n/Resources");

    // Language-specific files
    for (const language of config.supportedLanguages) {
      const langPath = path.join(basePath, `${language}.lproj`);

      // .strings files
      const stringsFiles = [
        "Localizable.strings",
        "InfoPlist.strings",
        "AppShortcuts.strings",
      ];
      for (const file of stringsFiles) {
        paths.push(path.join(langPath, file));
      }

      // .json files
      const jsonFiles = [
        "Localizable.json",
        "InfoPlist.json",
        "AppShortcuts.json",
      ];
      for (const file of jsonFiles) {
        paths.push(path.join(langPath, file));
      }
    }

    // XCStrings files
    const xcstringsFiles = [
      "Localizable.xcstrings",
      "InfoPlist.xcstrings",
      "AppShortcuts.xcstrings",
    ];
    for (const file of xcstringsFiles) {
      paths.push(path.join(basePath, file));
    }

    return paths;
  }

  /**
   * Generate processing report
   */
  static generateProcessingReport(results: FileProcessingResult[]): string {
    const lines: string[] = [];
    let totalProcessed = 0;
    let totalKeys = 0;
    let failedFiles = 0;

    lines.push("File Processing Report");
    lines.push("=".repeat(50));

    for (const result of results) {
      const fileName = path.basename(result.filePath);

      if (result.success) {
        lines.push(`✅ ${fileName}: ${result.keysProcessed} keys processed`);
        totalKeys += result.keysProcessed;
        totalProcessed++;
      } else {
        lines.push(`❌ ${fileName}: ${result.error}`);
        failedFiles++;
      }
    }

    lines.push("-".repeat(50));
    lines.push(`Total Files Processed: ${totalProcessed}`);
    lines.push(`Total Keys Processed: ${totalKeys}`);
    lines.push(`Failed Files: ${failedFiles}`);
    lines.push(
      `Success Rate: ${Math.round((totalProcessed / results.length) * 100)}%`,
    );

    return lines.join("\n");
  }

  /**
   * Validate file processing results
   */
  static validateProcessingResults(results: FileProcessingResult[]): {
    isValid: boolean;
    errors: string[];
    totalKeysProcessed: number;
  } {
    const errors: string[] = [];
    let totalKeysProcessed = 0;

    for (const result of results) {
      if (!result.success) {
        errors.push(`Failed to process ${result.filePath}: ${result.error}`);
      } else {
        totalKeysProcessed += result.keysProcessed;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      totalKeysProcessed,
    };
  }
}
