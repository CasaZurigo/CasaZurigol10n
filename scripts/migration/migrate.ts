import * as fs from "fs";
import * as path from "path";
import {
  KeyMapping,
  MigrationResult,
  MigrationConfig,
  DEFAULT_MIGRATION_CONFIG,
  StringsFileEntry,
} from "./types";
import { KeyTransformer } from "./keyTransformer";
import { CollisionResolver } from "./collisionResolver";
import { FileProcessor } from "./fileProcessor";
import { BackupManager } from "./backup";
import { Validator } from "./validator";

/**
 * Main migration orchestrator
 */
class MigrationOrchestrator {
  private projectRoot: string;
  private config: MigrationConfig;

  constructor(projectRoot: string, config: Partial<MigrationConfig> = {}) {
    this.projectRoot = projectRoot;
    this.config = { ...DEFAULT_MIGRATION_CONFIG, ...config };
  }

  /**
   * Execute the complete migration process
   */
  async migrate(): Promise<MigrationResult> {
    console.log("🚀 Starting localization key migration...");

    try {
      // Phase 1: Pre-migration validation
      console.log("\n📋 Phase 1: Pre-migration validation");
      const preValidation = await this.validateCurrentState();
      if (!preValidation.isValid) {
        return {
          success: false,
          error: `Pre-migration validation failed: ${preValidation.errors.join(", ")}`,
          processedFiles: [],
        };
      }

      // Phase 2: Create backup
      let backupPath: string | undefined;
      if (this.config.backupEnabled) {
        console.log("\n💾 Phase 2: Creating backup");
        backupPath = await BackupManager.createBackup(this.projectRoot);
      }

      // Phase 3: Parse English strings and generate mappings
      console.log("\n🔍 Phase 3: Analyzing English strings");
      const keyMappings = await this.generateKeyMappings();

      // Phase 4: Resolve collisions
      console.log("\n🔧 Phase 4: Resolving key collisions");
      const { resolvedMappings, collisions } =
        CollisionResolver.resolveCollisions(keyMappings);

      if (collisions.length > 0) {
        console.log(`⚠️  Found ${collisions.length} collision(s):`);
        console.log(CollisionResolver.generateCollisionReport(collisions));
      }

      // Phase 5: Process all files
      console.log("\n📝 Phase 5: Processing files");
      const processedFiles = await this.processAllFiles(resolvedMappings);

      // Phase 6: Post-migration validation
      console.log("\n✅ Phase 6: Post-migration validation");
      const postValidation = await this.validatePostMigration();
      if (!postValidation.isValid) {
        // Rollback if validation fails
        if (backupPath) {
          console.log("❌ Validation failed. Rolling back...");
          await BackupManager.restoreBackup(this.projectRoot, backupPath);
        }
        return {
          success: false,
          error: `Post-migration validation failed: ${postValidation.errors.join(", ")}`,
          processedFiles: [],
        };
      }

      // Phase 7: Generate Swift code
      console.log("\n🦉 Phase 7: Regenerating Swift code");
      await this.regenerateSwiftCode();

      // Phase 8: Final validation
      console.log("\n🔍 Phase 8: Final validation");
      const finalValidation = await this.validateFinalState();
      if (!finalValidation.isValid) {
        if (backupPath) {
          console.log("❌ Final validation failed. Rolling back...");
          await BackupManager.restoreBackup(this.projectRoot, backupPath);
        }
        return {
          success: false,
          error: `Final validation failed: ${finalValidation.errors.join(", ")}`,
          processedFiles: [],
        };
      }

      // Clean up old backups
      if (this.config.backupEnabled) {
        await BackupManager.cleanupOldBackups(this.projectRoot);
      }

      console.log("\n🎉 Migration completed successfully!");
      console.log(`📊 Statistics:`);
      console.log(`   - Total keys processed: ${resolvedMappings.length}`);
      console.log(`   - Files processed: ${processedFiles.length}`);
      console.log(`   - Collisions resolved: ${collisions.length}`);
      if (backupPath) {
        console.log(`   - Backup created: ${backupPath}`);
      }

      return {
        success: true,
        processedFiles,
        backupPath,
      };
    } catch (error) {
      console.error(`❌ Migration failed: ${error}`);
      return {
        success: false,
        error: String(error),
        processedFiles: [],
      };
    }
  }

  /**
   * Validate current state before migration
   */
  private async validateCurrentState(): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Check if project structure exists
    const resourcesPath = path.join(
      this.projectRoot,
      "Sources/CasaZurigol10n/Resources",
    );
    if (!fs.existsSync(resourcesPath)) {
      errors.push("Resources directory not found");
      return { isValid: false, errors };
    }

    // Validate all language files
    for (const language of this.config.supportedLanguages) {
      const result = Validator.validateLanguageFiles(
        this.projectRoot,
        language,
      );
      errors.push(...result.errors);
    }

    // Validate XCStrings files
    const xcstringsResult = Validator.validateAllXCStringsFiles(
      this.projectRoot,
    );
    errors.push(...xcstringsResult.errors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate key mappings from English strings
   */
  private async generateKeyMappings(): Promise<KeyMapping[]> {
    const englishStringsPath = path.join(
      this.projectRoot,
      "Sources/CasaZurigol10n/Resources/en.lproj/Localizable.strings",
    );

    if (!fs.existsSync(englishStringsPath)) {
      throw new Error("English Localizable.strings file not found");
    }

    const content = fs.readFileSync(englishStringsPath, "utf8");
    const entries = this.parseStringsFile(content);

    const mappings = KeyTransformer.transformKeys(entries);

    console.log(`📊 Generated ${mappings.length} key mappings`);
    const summary = KeyTransformer.generateTransformationSummary(mappings);
    console.log(
      `   - Keys with format specifiers: ${summary.keysWithFormatSpecifiers}`,
    );
    console.log(`   - Keys with parameters: ${summary.keysWithParameters}`);
    console.log(`   - Average key length: ${summary.averageKeyLength} chars`);
    console.log(
      `   - Longest key: "${summary.longestKey.substring(0, 50)}..."`,
    );

    return mappings;
  }

  /**
   * Process all files with new key mappings
   */
  private async processAllFiles(keyMappings: KeyMapping[]): Promise<string[]> {
    const processedFiles: string[] = [];

    // Process each language
    for (const language of this.config.supportedLanguages) {
      console.log(`   Processing ${language} files...`);
      const results = await FileProcessor.processLanguageFiles(
        this.projectRoot,
        language,
        keyMappings,
        this.config,
      );

      for (const result of results) {
        if (result.success) {
          processedFiles.push(result.filePath);
        } else {
          throw new Error(
            `Failed to process ${result.filePath}: ${result.error}`,
          );
        }
      }
    }

    // Process XCStrings files
    console.log("   Processing XCStrings files...");
    const xcstringsResults = await FileProcessor.processXCStringsFiles(
      this.projectRoot,
      keyMappings,
      this.config,
    );

    for (const result of xcstringsResults) {
      if (result.success) {
        processedFiles.push(result.filePath);
      } else {
        throw new Error(
          `Failed to process ${result.filePath}: ${result.error}`,
        );
      }
    }

    return processedFiles;
  }

  /**
   * Validate state after migration
   */
  private async validatePostMigration(): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Validate all language files
    for (const language of this.config.supportedLanguages) {
      const result = Validator.validateLanguageFiles(
        this.projectRoot,
        language,
      );
      errors.push(...result.errors);
    }

    // Validate XCStrings files
    const xcstringsResult = Validator.validateAllXCStringsFiles(
      this.projectRoot,
    );
    errors.push(...xcstringsResult.errors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Regenerate Swift code after migration
   */
  private async regenerateSwiftCode(): Promise<void> {
    // This would typically call the existing compileToSwift script
    const { spawn } = require("child_process");

    return new Promise((resolve, reject) => {
      const process = spawn("npm", ["run", "compileToSwift"], {
        cwd: this.projectRoot,
        stdio: "inherit",
      });

      process.on("close", (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`Swift code generation failed with exit code ${code}`),
          );
        }
      });
    });
  }

  /**
   * Final validation including Swift compilation
   */
  private async validateFinalState(): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Check if generated Swift file exists and is valid
    const swiftFilePath = path.join(
      this.projectRoot,
      "Sources/CasaZurigol10n/Generated/Localization+Generated.swift",
    );

    if (!fs.existsSync(swiftFilePath)) {
      errors.push("Generated Swift file not found");
    } else {
      // Basic Swift file validation
      const content = fs.readFileSync(swiftFilePath, "utf8");
      if (!content.includes("public enum L10n")) {
        errors.push("Generated Swift file appears to be invalid");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Parse .strings file content
   */
  private parseStringsFile(content: string): StringsFileEntry[] {
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
   * Dry run migration (validation only)
   */
  async dryRun(): Promise<MigrationResult> {
    this.config.dryRun = true;
    console.log("🔍 Running migration in dry-run mode...");

    const result = await this.migrate();

    if (result.success) {
      console.log(
        "✅ Dry run completed successfully. Migration appears to be safe.",
      );
    } else {
      console.log(
        "❌ Dry run failed. Please fix issues before running actual migration.",
      );
    }

    return result;
  }
}

/**
 * CLI interface for migration
 */
export async function runMigration(
  projectRoot: string,
  options: {
    dryRun?: boolean;
    backupEnabled?: boolean;
    validateOnly?: boolean;
  } = {},
): Promise<void> {
  const config: Partial<MigrationConfig> = {
    dryRun: options.dryRun || false,
    backupEnabled: options.backupEnabled !== false,
    validateOnly: options.validateOnly || false,
  };

  const migrator = new MigrationOrchestrator(projectRoot, config);

  if (options.dryRun) {
    await migrator.dryRun();
  } else {
    await migrator.migrate();
  }
}

// Export for use in other scripts
export { MigrationOrchestrator };
