import { Command } from "commander";
import path from "path";
import fs from "fs";
import { FileHandlerFactory } from "./fileHandlers";

export class FileSynchronizer {
  private stringsHandler = FileHandlerFactory.getStringsFileHandler();
  private jsonHandler = FileHandlerFactory.getJsonFileHandler();

  private getMatchingFiles(
    directory: string,
    baseName: string,
  ): { strings?: string; json?: string } {
    const stringsFile = path.join(directory, `${baseName}.strings`);
    const jsonFile = path.join(directory, `${baseName}.json`);

    return {
      strings: fs.existsSync(stringsFile) ? stringsFile : undefined,
      json: fs.existsSync(jsonFile) ? jsonFile : undefined,
    };
  }

  private mergeTranslations(
    stringsTranslations: Record<string, string>,
    jsonTranslations: Record<string, string>,
  ): Record<string, string> {
    return {
      ...jsonTranslations,
      ...stringsTranslations,
    };
  }

  async syncFiles(
    inputDir: string,
    languages: string[],
    specificFile?: string,
  ): Promise<void> {
    for (const lang of languages) {
      const langDir = path.join(inputDir, `${lang}.lproj`);

      if (!fs.existsSync(langDir)) {
        console.log(`Skipping ${langDir} - directory does not exist`);
        continue;
      }

      const files = specificFile
        ? [specificFile]
        : fs
            .readdirSync(langDir)
            .filter((f) => f.endsWith(".strings") || f.endsWith(".json"))
            .map((f) => path.parse(f).name)
            .filter((value, index, self) => self.indexOf(value) === index);

      for (const baseName of files) {
        const { strings: stringsFile, json: jsonFile } = this.getMatchingFiles(
          langDir,
          baseName,
        );

        if (!stringsFile && !jsonFile) {
          console.log(`No matching files found for ${baseName} in ${langDir}`);
          continue;
        }

        let stringsTranslations: Record<string, string> = {};
        let jsonTranslations: Record<string, string> = {};

        if (stringsFile) {
          stringsTranslations = this.stringsHandler.parseFile(stringsFile);
        }

        if (jsonFile) {
          jsonTranslations = this.jsonHandler.parseFile(jsonFile);
        }

        const mergedTranslations = this.mergeTranslations(
          stringsTranslations,
          jsonTranslations,
        );

        // Write back to both files
        if (stringsFile) {
          this.stringsHandler.createFile(mergedTranslations, stringsFile);
          console.log(`Updated ${stringsFile}`);
        }

        if (jsonFile) {
          this.jsonHandler.createFile(mergedTranslations, jsonFile);
          console.log(`Updated ${jsonFile}`);
        }
      }
    }
  }
}

const program = new Command();

program
  .option(
    "--input-dir <path>",
    "Input directory",
    "./Sources/CasaZurigol10n/Resources",
  )
  .option(
    "--languages <langs...>",
    "Language codes to sync",
    process.env.TARGET_LANG?.split(",") || [
      "en",
      "fr",
      "it",
      "es",
      "pt-PT",
      "tr",
      "de",
    ],
  )
  .option("--file <name>", "Specific file to sync (without extension)")
  .parse(process.argv);

const options = program.opts();

const synchronizer = new FileSynchronizer();

synchronizer
  .syncFiles(options.inputDir, options.languages, options.file)
  .catch((error) => {
    console.error("File synchronization failed:", error);
    process.exit(1);
  });
