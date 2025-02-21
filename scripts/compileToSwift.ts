type IndentSize = 2 | 4;
type NewLineCount = 1 | 2;
type CommentType = "single" | "doc" | "mark";
type TextStyle = "bold" | "italic" | "code";

interface PropertyDeclarationParams {
  key: string;
  sanitizedKey: string;
  value: string;
  tableName: string;
}

interface EnumDeclarationParams {
  name: string;
  content: string;
}

interface FormattingOptions {
  indent?: IndentSize;
  newLines?: NewLineCount;
  addTrailingNewLine?: boolean;
}

interface SwiftFormattingUtils {
  readonly SINGLE_INDENT: IndentSize;
  readonly DOUBLE_INDENT: IndentSize;

  indent(text: string, spaces?: IndentSize): string;
  joinWithNewLines(lines: string[], count?: NewLineCount): string;
  wrapInBraces(content: string, options?: FormattingOptions): string;
  wrapInComment(text: string, type?: CommentType): string;
  formatMarkup(text: string, style: TextStyle): string;
  addBlankLines(text: string, count?: NewLineCount): string;
}

interface SwiftTemplates {
  propertyComment: (value: string) => string;
  propertyDeclaration: (params: PropertyDeclarationParams) => string[];
  enumDeclaration: (params: EnumDeclarationParams) => string[];
  fileHeader: string[];
  fileFooter: string[];
}

const SwiftFormatting: SwiftFormattingUtils = {
  SINGLE_INDENT: 2,
  DOUBLE_INDENT: 4,

  indent(
    text: string,
    spaces: IndentSize = SwiftFormatting.SINGLE_INDENT,
  ): string {
    return text
      .split("\n")
      .map((line) => " ".repeat(spaces) + line)
      .join("\n");
  },

  joinWithNewLines(lines: string[], count: NewLineCount = 1): string {
    return lines.filter(Boolean).join("\n".repeat(count));
  },

  wrapInBraces(
    content: string,
    options: FormattingOptions = {
      indent: SwiftFormatting.SINGLE_INDENT,
      newLines: 1,
      addTrailingNewLine: true,
    },
  ): string {
    const {
      indent = SwiftFormatting.SINGLE_INDENT,
      newLines = 1,
      addTrailingNewLine = true,
    } = options;

    return `{${addTrailingNewLine ? "\n".repeat(newLines) : ""}${SwiftFormatting.indent(
      content,
      indent,
    )}${addTrailingNewLine ? "\n".repeat(newLines) : ""}}`;
  },

  wrapInComment(text: string, type: CommentType = "single"): string {
    switch (type) {
      case "doc":
        return `/// ${text}`;
      case "mark":
        return `// MARK: - ${text}`;
      default:
        return `// ${text}`;
    }
  },

  formatMarkup(text: string, style: TextStyle): string {
    const markers: Record<TextStyle, string> = {
      bold: "**",
      italic: "_",
      code: "`",
    };
    return `${markers[style]}${text}${markers[style]}`;
  },

  addBlankLines(text: string, count: NewLineCount = 1): string {
    return `${text}${"\n".repeat(count)}`;
  },
};

const SWIFT_TEMPLATES: SwiftTemplates = {
  propertyComment: (value) => `/// ${value}`,

  propertyDeclaration: ({ key, sanitizedKey, value, tableName }) => [
    `public static let ${sanitizedKey} = L10n.tr("${tableName}", "${key}", fallback: "${value}")`,
    `public static let ${sanitizedKey}_resource = LocalizedStringResource(`,
    `    "${key}",`,
    `    defaultValue: "${value}",`,
    `    table: "${tableName}",`,
    `    locale: Locale.current,`,
    `    bundle: .atURL(BundleToken.bundle.bundleURL),`,
    `    comment: 'nil'`,
    `)`,
    `public static let ${sanitizedKey}_key = "${key}"`,
  ],

  enumDeclaration: ({ name, content }) => [
    `public enum ${name} {`,
    content,
    `}`,
  ],

  fileHeader: [
    "// swiftlint:disable all",
    "import Foundation",
    "",
    "// Generated using strings-to-swift compiler",
    "// Do not edit directly",
    "",
    "// swiftlint:disable superfluous_disable_command file_length implicit_return prefer_self_in_static_references",
    "// swiftlint:disable explicit_type_interface function_parameter_count identifier_name line_length",
    "// swiftlint:disable nesting type_body_length type_name vertical_whitespace_opening_braces",
    "",
  ],

  fileFooter: [
    "",
    "// swiftlint:enable explicit_type_interface function_parameter_count identifier_name line_length",
    "// swiftlint:enable nesting type_body_length type_name vertical_whitespace_opening_braces",
    "",
    "extension L10n {",
    "  private static func tr(_ table: String, _ key: String, _ args: CVarArg..., fallback value: String) -> String {",
    "    let format = BundleToken.bundle.localizedString(forKey: key, value: value, table: table)",
    "    return String(format: format, locale: Locale.current, arguments: args)",
    "  }",
    "}",
    "",
    "// swiftlint:disable convenience_type",
    "private final class BundleToken {",
    "  static let bundle: Bundle = {",
    "    #if SWIFT_PACKAGE",
    "    return Bundle.module",
    "    #else",
    "    return Bundle(for: BundleToken.self)",
    "    #endif",
    "  }()",
    "}",
    "// swiftlint:enable convenience_type",
  ],
};

import { Command } from "commander";
import path from "path";
import fs from "fs";
import { FileHandlerFactory } from "./fileHandlers";

interface StringTable {
  name: string;
  translations: Record<string, string>;
}

class SwiftCompiler {
  private stringTables: StringTable[] = [];
  private ignoredFiles: Set<string>;
  private template: SwiftTemplates;

  constructor(
    ignoredFiles: string[] = [],
    template: SwiftTemplates = SWIFT_TEMPLATES,
  ) {
    this.ignoredFiles = new Set(ignoredFiles.map((f) => f.toLowerCase()));
    this.template = template;
  }

  private sanitizeKey(key: string): string {
    let workingString = key;
    const matched = key.match(/^[A-Z]+/);
    if (matched) {
      let prefixMatch = matched[0];
      let prefixMatchLength = prefixMatch.length;

      if (prefixMatchLength <= key.length) {
        let prefix = key.slice(0, prefixMatchLength).toLowerCase();
        const prefixLength = prefix.length;

        if (prefixLength > 1) {
          prefix =
            prefix.slice(0, prefixLength - 1) + prefix.slice(-1).toUpperCase();
        }

        workingString = prefix;

        if (prefixLength < key.length) {
          let rest = key.slice(prefixLength);
          workingString += rest;
        }
      }
    }

    let parts = workingString.split("_");

    if (parts.length === 1) {
      return workingString;
    }

    return parts
      .map((part, index) => {
        if (index === 0) {
          return part.toLowerCase();
        }
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join("");
  }

  private getTableName(filePath: string): string | null {
    if (this.shouldIgnoreFile(filePath)) {
      return null;
    }

    const filename = path.basename(filePath);
    return filename.replace(".strings", "");
  }

  private shouldIgnoreFile(filePath: string): boolean {
    const filename = path.basename(filePath);
    return this.ignoredFiles.has(filename.toLowerCase());
  }

  private generatePropertyDeclaration(
    key: string,
    value: string,
    tableName: string,
  ): string {
    const sanitizedKey = this.sanitizeKey(key);
    return SwiftFormatting.joinWithNewLines([
      this.template.propertyComment(value),
      SwiftFormatting.joinWithNewLines(
        this.template.propertyDeclaration({
          key,
          sanitizedKey,
          value,
          tableName,
        }),
      ),
    ]);
  }

  private generateEnumDeclaration(table: StringTable): string {
    const sortedTranslations = Object.entries(table.translations).sort(
      ([key1], [key2]) => key1.localeCompare(key2),
    );

    const translationsContent = SwiftFormatting.joinWithNewLines(
      sortedTranslations.map(([key, value]) =>
        this.generatePropertyDeclaration(key, value, table.name),
      ),
      2,
    );

    return SwiftFormatting.joinWithNewLines(
      this.template.enumDeclaration({
        name: table.name,
        content: SwiftFormatting.indent(
          translationsContent,
          SwiftFormatting.SINGLE_INDENT,
        ),
      }),
    );
  }

  public parseStringsFile(filePath: string) {
    if (this.shouldIgnoreFile(filePath)) {
      console.log(`Skipping ignored file: ${filePath}`);
      return;
    }

    const tableName = this.getTableName(filePath);
    if (tableName) {
      const parsedTranslations =
        FileHandlerFactory.getStringsFileHandler().parseFile(filePath);
      this.stringTables.push({
        name: tableName,
        translations: parsedTranslations,
      });
    }
  }

  public parseDirectory(inputDir: string) {
    const files = fs.readdirSync(inputDir);

    for (const file of files) {
      if (file.endsWith(".strings")) {
        const filePath = path.join(inputDir, file);
        this.parseStringsFile(filePath);
      }
    }
  }

  public compile(): string {
    const enumContent = SwiftFormatting.joinWithNewLines(
      this.stringTables.map((table) => this.generateEnumDeclaration(table)),
      2,
    );

    return SwiftFormatting.joinWithNewLines([
      SwiftFormatting.joinWithNewLines(this.template.fileHeader),
      "public enum L10n {",
      SwiftFormatting.indent(enumContent, SwiftFormatting.SINGLE_INDENT),
      "}",
      SwiftFormatting.joinWithNewLines(this.template.fileFooter),
    ]);
  }
}

const program = new Command();

program
  .requiredOption(
    "--input-dir <path>",
    "Input directory containing .strings files",
    "./Sources/CasaZurigol10n/Resources/en.lproj",
  )
  .option("--ignore <files>", "Comma-separated list of files to ignore", "")
  .requiredOption(
    "--output <path>",
    "Output Swift file path",
    "./Sources/CasaZurigol10n/Generated/Localization+Generated.swift",
  )
  .parse(process.argv);

const options = program.opts();

try {
  // Parse ignored files
  const ignoredFiles = options.ignore
    .split(",")
    .map((f: string) => f.trim())
    .filter(Boolean);

  const generator = new SwiftCompiler(ignoredFiles);

  // Parse all .strings files in the directory
  generator.parseDirectory(options.inputDir);

  // Generate and write Swift code
  const swiftCode = generator.compile();

  // Ensure output directory exists
  const outputDir = path.dirname(options.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(options.output, swiftCode);

  console.log(`Successfully generated Swift code at: ${options.output}`);
} catch (error) {
  console.error("Error:", error);
  process.exit(1);
}
