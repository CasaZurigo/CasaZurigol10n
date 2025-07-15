import * as fs from "fs";
import { ValidationResult, StringsFileEntry, XCStringsEntry } from "./types";

/**
 * Validation utilities for different localization file formats
 */
export class Validator {
  /**
   * Validate a .strings file format
   */
  static validateStringsFile(filePath: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!fs.existsSync(filePath)) {
        errors.push(`File does not exist: ${filePath}`);
        return { isValid: false, errors, warnings };
      }

      const content = fs.readFileSync(filePath, "utf8");
      const entries = this.parseStringsFile(content);

      // Validate syntax
      this.validateStringsFileSyntax(content, errors, warnings);

      // Validate entries
      this.validateStringsFileEntries(entries, errors, warnings);
    } catch (error) {
      errors.push(`Failed to validate strings file: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a .json file format
   */
  static validateJSONFile(filePath: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!fs.existsSync(filePath)) {
        errors.push(`File does not exist: ${filePath}`);
        return { isValid: false, errors, warnings };
      }

      const content = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(content);

      // Validate structure
      if (typeof parsed !== "object" || parsed === null) {
        errors.push("JSON file must contain an object");
      }

      // Validate entries
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== "string") {
          errors.push(`Value for key "${key}" must be a string`);
        }
        if (key.trim() === "") {
          errors.push("Keys cannot be empty");
        }
      }
    } catch (error) {
      errors.push(`Failed to validate JSON file: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a .xcstrings file format
   */
  static validateXCStringsFile(filePath: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!fs.existsSync(filePath)) {
        errors.push(`File does not exist: ${filePath}`);
        return { isValid: false, errors, warnings };
      }

      const content = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(content);

      // Validate top-level structure
      if (!parsed.sourceLanguage) {
        errors.push("Missing sourceLanguage property");
      }

      if (!parsed.strings || typeof parsed.strings !== "object") {
        errors.push("Missing or invalid strings property");
      }

      if (!parsed.version) {
        errors.push("Missing version property");
      }

      // Validate strings entries
      if (parsed.strings) {
        for (const [key, entry] of Object.entries(parsed.strings)) {
          this.validateXCStringsEntry(key, entry as any, errors, warnings);
        }
      }
    } catch (error) {
      errors.push(`Failed to validate XCStrings file: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate all related files for a given language
   */
  static validateLanguageFiles(
    projectRoot: string,
    language: string,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const basePath = `${projectRoot}/Sources/CasaZurigol10n/Resources`;
    const langPath = `${basePath}/${language}.lproj`;

    // Validate .strings files
    const stringsFiles = [
      "Localizable.strings",
      "InfoPlist.strings",
      "AppShortcuts.strings",
    ];
    for (const file of stringsFiles) {
      const filePath = `${langPath}/${file}`;
      const result = this.validateStringsFile(filePath);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    // Validate .json files
    const jsonFiles = [
      "Localizable.json",
      "InfoPlist.json",
      "AppShortcuts.json",
    ];
    for (const file of jsonFiles) {
      const filePath = `${langPath}/${file}`;
      const result = this.validateJSONFile(filePath);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate all XCStrings files
   */
  static validateAllXCStringsFiles(projectRoot: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const basePath = `${projectRoot}/Sources/CasaZurigol10n/Resources`;
    const xcstringsFiles = [
      "Localizable.xcstrings",
      "InfoPlist.xcstrings",
      "AppShortcuts.xcstrings",
    ];

    for (const file of xcstringsFiles) {
      const filePath = `${basePath}/${file}`;
      const result = this.validateXCStringsFile(filePath);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
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
   * Validate .strings file syntax
   */
  private static validateStringsFileSyntax(
    content: string,
    errors: string[],
    warnings: string[],
  ): void {
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Skip empty lines and comments
      if (!line || line.startsWith("//") || line.startsWith("/*")) {
        continue;
      }

      // Check for proper key-value format
      if (!line.match(/^".*"\s*=\s*".*"\s*;?\s*$/)) {
        errors.push(`Invalid syntax at line ${lineNumber}: ${line}`);
      }

      // Check for unescaped quotes
      if (
        line.includes('"') &&
        !line.match(/^"[^"]*(?:\\.[^"]*)*"\s*=\s*"[^"]*(?:\\.[^"]*)*"\s*;?\s*$/)
      ) {
        warnings.push(
          `Possible unescaped quote at line ${lineNumber}: ${line}`,
        );
      }
    }
  }

  /**
   * Validate .strings file entries
   */
  private static validateStringsFileEntries(
    entries: StringsFileEntry[],
    errors: string[],
    warnings: string[],
  ): void {
    const keySet = new Set<string>();

    for (const entry of entries) {
      // Check for duplicate keys
      if (keySet.has(entry.key)) {
        errors.push(`Duplicate key found: "${entry.key}"`);
      }
      keySet.add(entry.key);

      // Check for empty keys
      if (!entry.key.trim()) {
        errors.push("Empty key found");
      }

      // Check for empty values
      if (!entry.value.trim()) {
        warnings.push(`Empty value for key: "${entry.key}"`);
      }
    }
  }

  /**
   * Validate XCStrings entry
   */
  private static validateXCStringsEntry(
    key: string,
    entry: any,
    errors: string[],
    warnings: string[],
  ): void {
    if (!entry.localizations || typeof entry.localizations !== "object") {
      errors.push(`Invalid localizations for key "${key}"`);
      return;
    }

    for (const [lang, localization] of Object.entries(entry.localizations)) {
      const loc = localization as any;

      if (!loc.stringUnit || typeof loc.stringUnit !== "object") {
        errors.push(
          `Invalid stringUnit for key "${key}" in language "${lang}"`,
        );
        continue;
      }

      if (!loc.stringUnit.state) {
        errors.push(`Missing state for key "${key}" in language "${lang}"`);
      }

      if (!loc.stringUnit.value) {
        warnings.push(`Empty value for key "${key}" in language "${lang}"`);
      }
    }
  }

  /**
   * Generate validation report
   */
  static generateValidationReport(results: ValidationResult[]): string {
    const lines: string[] = [];
    let totalErrors = 0;
    let totalWarnings = 0;

    lines.push("Validation Report");
    lines.push("=".repeat(50));

    for (const result of results) {
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;

      if (result.errors.length > 0) {
        lines.push(`❌ Errors: ${result.errors.length}`);
        for (const error of result.errors) {
          lines.push(`   - ${error}`);
        }
      }

      if (result.warnings.length > 0) {
        lines.push(`⚠️  Warnings: ${result.warnings.length}`);
        for (const warning of result.warnings) {
          lines.push(`   - ${warning}`);
        }
      }
    }

    lines.push("-".repeat(50));
    lines.push(`Total Errors: ${totalErrors}`);
    lines.push(`Total Warnings: ${totalWarnings}`);
    lines.push(
      `Overall Status: ${totalErrors === 0 ? "✅ Valid" : "❌ Invalid"}`,
    );

    return lines.join("\n");
  }
}
