import { Command } from "commander";
import path from "path";
import fs from "fs";
import { FileHandlerFactory } from "./fileHandlers";

class StringsEditor {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  deleteEntry(filePath: string, keyToDelete: string): boolean {
    try {
      const handler = FileHandlerFactory.getHandler(filePath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const translations = handler.parseFile(filePath);
        const lowerKey = keyToDelete.toLowerCase();

        if (lowerKey in translations) {
          delete translations[lowerKey];
          handler.createFile(translations, filePath);
          console.log(`Deleted key '${keyToDelete}' from ${filePath}`);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error(`Error deleting key in file '${filePath}': ${err}`);
      return false;
    }
  }

  deleteEntryFromAllFiles(keyToDelete: string): number {
    let deletionsCount = 0;

    const processDirectory = (dirPath: string) => {
      const files = fs.readdirSync(dirPath);

      files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          processDirectory(fullPath);
        } else {
          if (this.deleteEntry(fullPath, keyToDelete)) {
            deletionsCount++;
          }
        }
      });
    };

    processDirectory(this.basePath);
    return deletionsCount;
  }
}

const program = new Command();

program
  .requiredOption("--key <key>", "The key to delete from all files")
  .parse(process.argv);

const basePath = "./Sources/CasaZurigol10n/Resources";
const options = program.opts();
const editor = new StringsEditor(basePath);
const deletions = editor.deleteEntryFromAllFiles(options.key);
console.log(`\nTotal deletions performed: ${deletions}`);
