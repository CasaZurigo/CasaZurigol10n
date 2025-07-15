import { KeyMapping, StringsFileEntry } from "./types";

/**
 * Core key transformation logic for migration
 */
export class KeyTransformer {
  private static readonly FORMAT_SPECIFIER_REGEX =
    /%[@dfsioxX]|%[0-9]*\.?[0-9]*[@dfsioxX]/g;
  private static readonly PARAMETER_REGEX = /\$\{[^}]+\}/g;
  private static readonly SWIFT_INVALID_CHARS = /[^a-zA-Z0-9_]/g;
  private static readonly SWIFT_KEYWORDS = new Set([
    "class",
    "struct",
    "enum",
    "protocol",
    "extension",
    "func",
    "var",
    "let",
    "if",
    "else",
    "switch",
    "case",
    "default",
    "for",
    "while",
    "repeat",
    "return",
    "break",
    "continue",
    "import",
    "public",
    "private",
    "internal",
    "fileprivate",
    "static",
    "final",
    "override",
    "init",
    "deinit",
    "self",
    "super",
    "nil",
    "true",
    "false",
    "in",
    "is",
    "as",
    "try",
    "catch",
    "throw",
    "throws",
    "rethrows",
    "defer",
    "guard",
    "where",
    "associatedtype",
    "typealias",
    "subscript",
    "operator",
    "precedencegroup",
    "inout",
    "mutating",
    "nonmutating",
    "convenience",
    "required",
    "lazy",
    "weak",
    "unowned",
    "indirect",
    "dynamic",
    "optional",
    "available",
    "objc",
    "nonobjc",
    "IBAction",
    "IBOutlet",
    "IBInspectable",
    "IBDesignable",
    "autoclosure",
    "escaping",
    "discardableResult",
    "warn_unused_result",
    "testable",
  ]);

  /**
   * Transform a collection of strings file entries to new key mappings
   */
  static transformKeys(entries: StringsFileEntry[]): KeyMapping[] {
    const mappings: KeyMapping[] = [];

    for (const entry of entries) {
      const mapping = this.createKeyMapping(entry);
      mappings.push(mapping);
    }

    return mappings;
  }

  /**
   * Create a key mapping from a strings file entry
   */
  private static createKeyMapping(entry: StringsFileEntry): KeyMapping {
    const hasFormatSpecifiers = this.hasFormatSpecifiers(entry.value);
    const hasParameters = this.hasParameters(entry.value);
    const swiftIdentifier = this.generateSwiftIdentifier(entry.value);

    return {
      oldKey: entry.key,
      newKey: entry.value,
      englishValue: entry.value,
      hasFormatSpecifiers,
      hasParameters,
      swiftIdentifier,
    };
  }

  /**
   * Check if a value contains format specifiers like %@, %d, etc.
   */
  private static hasFormatSpecifiers(value: string): boolean {
    return this.FORMAT_SPECIFIER_REGEX.test(value);
  }

  /**
   * Check if a value contains parameters like ${location}, ${applicationName}
   */
  private static hasParameters(value: string): boolean {
    return this.PARAMETER_REGEX.test(value);
  }

  /**
   * Generate a Swift-safe identifier from English text
   */
  static generateSwiftIdentifier(englishValue: string): string {
    // Remove format specifiers and parameters for identifier generation
    let identifier = englishValue
      .replace(this.FORMAT_SPECIFIER_REGEX, "")
      .replace(this.PARAMETER_REGEX, "");

    // Convert to camelCase
    identifier = this.toCamelCase(identifier);

    // Remove invalid characters
    identifier = identifier.replace(this.SWIFT_INVALID_CHARS, "");

    // Ensure it doesn't start with a number
    if (/^[0-9]/.test(identifier)) {
      identifier = "_" + identifier;
    }

    // Handle empty identifier
    if (!identifier) {
      identifier = "unknownKey";
    }

    // Handle Swift keywords
    if (this.SWIFT_KEYWORDS.has(identifier)) {
      identifier = "`" + identifier + "`";
    }

    return identifier;
  }

  /**
   * Convert text to camelCase
   */
  static toCamelCase(text: string): string {
    return text
      .toLowerCase()
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, "");
  }

  /**
   * Escape special characters for .strings file format
   */
  static escapeForStrings(value: string): string {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  }

  /**
   * Escape special characters for JSON format
   */
  static escapeForJSON(value: string): string {
    return JSON.stringify(value).slice(1, -1);
  }

  /**
   * Validate that a key is suitable for use as a localization key
   */
  static validateKey(key: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!key || key.trim().length === 0) {
      issues.push("Key cannot be empty");
    }

    if (key.length > 200) {
      issues.push("Key is too long (max 200 characters)");
    }

    if (key.includes("\n") || key.includes("\r")) {
      issues.push("Key cannot contain newlines");
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Generate a summary of transformation statistics
   */
  static generateTransformationSummary(mappings: KeyMapping[]): {
    totalKeys: number;
    keysWithFormatSpecifiers: number;
    keysWithParameters: number;
    averageKeyLength: number;
    longestKey: string;
  } {
    const totalKeys = mappings.length;
    const keysWithFormatSpecifiers = mappings.filter(
      (m) => m.hasFormatSpecifiers,
    ).length;
    const keysWithParameters = mappings.filter((m) => m.hasParameters).length;
    const averageKeyLength =
      mappings.reduce((sum, m) => sum + m.newKey.length, 0) / totalKeys;
    const longestKey = mappings.reduce(
      (longest, m) => (m.newKey.length > longest.length ? m.newKey : longest),
      "",
    );

    return {
      totalKeys,
      keysWithFormatSpecifiers,
      keysWithParameters,
      averageKeyLength: Math.round(averageKeyLength * 100) / 100,
      longestKey,
    };
  }
}
