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

  constructor(ignoredFiles: string[] = []) {
    this.ignoredFiles = new Set(ignoredFiles.map((f) => f.toLowerCase()));
  }

  private sanitizeKey(key: string): string {
    return key
      .split(/[._]/)
      .map((part, index) =>
        index === 0
          ? part.toLowerCase()
          : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
      )
      .join("");
  }

  private getTableName(filePath: string): string | null {
    if (this.shouldIgnoreFile(filePath)) {
      return null;
    }

    const filename = path.basename(filePath);
    return filename.replace(".strings", "");
  }

  private generateComment(value: string): string {
    return `/// ${value}`;
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
    const lines = [
      this.generateComment(value),
      `public static let ${sanitizedKey} = L10n.tr("${tableName}", "${key}", fallback: "${value}")`,
      `public static let ${sanitizedKey}_resource = LocalizedStringResource("${key}", defaultValue: "${value}", table: "${tableName}", locale: Locale.current, bundle: .atURL(BundleToken.bundle.bundleURL), comment: 'nil')`,
      `public static let ${sanitizedKey}_key = "${key}"`,
    ];
    return lines.join("\n    ");
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
    const enumContent = this.stringTables
      .map((table) => {
        const sortedTranslations = Object.entries(table.translations).sort(
          ([key1], [key2]) => key1.localeCompare(key2),
        );
        const translationsContent = sortedTranslations
          .map((translation) =>
            this.generatePropertyDeclaration(
              translation[0],
              translation[1],
              table.name,
            ),
          )
          .join("\n\n    ");

        return `  public enum ${table.name} {
    ${translationsContent}
  }`;
      })
      .join("\n\n");

    return `// swiftlint:disable all

import Foundation

// Generated using strings-to-swift compiler
// Do not edit directly

// swiftlint:disable superfluous_disable_command file_length implicit_return prefer_self_in_static_references


// swiftlint:disable explicit_type_interface function_parameter_count identifier_name line_length
// swiftlint:disable nesting type_body_length type_name vertical_whitespace_opening_braces
public enum L10n {
${enumContent}
}
// swiftlint:enable explicit_type_interface function_parameter_count identifier_name line_length
// swiftlint:enable nesting type_body_length type_name vertical_whitespace_opening_braces

extension L10n {
  private static func tr(_ table: String, _ key: String, _ args: CVarArg..., fallback value: String) -> String {
    let format = BundleToken.bundle.localizedString(forKey: key, value: value, table: table)
    return String(format: format, locale: Locale.current, arguments: args)
  }
}

// swiftlint:disable convenience_type
private final class BundleToken {
  static let bundle: Bundle = {
    #if SWIFT_PACKAGE
    return Bundle.module
    #else
    return Bundle(for: BundleToken.self)
    #endif
  }()
}
// swiftlint:enable convenience_type`;
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
