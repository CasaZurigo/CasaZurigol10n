#!/usr/bin/env node

import { program } from "commander";
import { runMigration } from "./migrate";
import * as path from "path";

/**
 * CLI interface for the migration tool
 */
program
  .name("migrate")
  .description("Migrate localization keys to use English values as keys")
  .version("1.0.0");

program
  .option("--dry-run", "Run migration in dry-run mode (validation only)", false)
  .option("--no-backup", "Disable backup creation", false)
  .option(
    "--validate-only",
    "Only validate current state, don't migrate",
    false,
  )
  .option("--project-root <path>", "Project root directory", process.cwd())
  .action(async (options) => {
    const projectRoot = path.resolve(options.projectRoot);

    console.log("🔧 CasaZurigol10n Migration Tool");
    console.log("=".repeat(40));
    console.log(`Project Root: ${projectRoot}`);
    console.log(`Mode: ${options.dryRun ? "Dry Run" : "Migration"}`);
    console.log(`Backup: ${options.backup ? "Enabled" : "Disabled"}`);
    console.log(`Validate Only: ${options.validateOnly ? "Yes" : "No"}`);
    console.log("");

    try {
      await runMigration(projectRoot, {
        dryRun: options.dryRun,
        backupEnabled: options.backup,
        validateOnly: options.validateOnly,
      });

      if (options.dryRun) {
        console.log("\n✅ Dry run completed successfully!");
        console.log(
          "💡 Run without --dry-run to perform the actual migration.",
        );
      } else if (options.validateOnly) {
        console.log("\n✅ Validation completed successfully!");
      } else {
        console.log("\n🎉 Migration completed successfully!");
        console.log(
          "💡 Remember to test your application to ensure everything works correctly.",
        );
      }
    } catch (error) {
      console.error("\n❌ Migration failed:", error);
      process.exit(1);
    }
  });

program.parse(process.argv);
