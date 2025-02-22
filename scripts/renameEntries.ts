import { Command } from "commander";
import path from "path";
import fs from "fs";
import { FileHandlerFactory } from "./fileHandlers";

class StringsEditor {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  renameKey(filePath: string, oldKey: string, newKey: string): boolean {
    try {
      const handler = FileHandlerFactory.getHandler(filePath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const translations = handler.parseFile(filePath);
        const oldKeyLower = oldKey.toLowerCase();
        const newKeyLower = newKey.toLowerCase();

        if (oldKeyLower in translations) {
          const value = translations[oldKeyLower];
          delete translations[oldKeyLower];
          translations[newKeyLower] = value;
          handler.createFile(translations, filePath);
          console.log(`Renamed key '${oldKey}' to '${newKey}' in ${filePath}`);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error(`Error renaming key in file '${filePath}': ${err}`);
      return false;
    }
  }

  renameKeyInAllFiles(oldKey: string, newKey: string): number {
    let renameCount = 0;

    const processDirectory = (dirPath: string) => {
      const files = fs.readdirSync(dirPath);

      files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          processDirectory(fullPath);
        } else {
          if (this.renameKey(fullPath, oldKey, newKey)) {
            renameCount++;
          }
        }
      });
    };

    processDirectory(this.basePath);
    return renameCount;
  }
}

const program = new Command();

program
  .requiredOption("--old-key <key>", "The key to be renamed")
  .requiredOption("--new-key <key>", "The new name for the key")
  .parse(process.argv);

const basePath = "./Sources/CasaZurigol10n/Resources";
const options = program.opts();
const editor = new StringsEditor(basePath);
const renames = editor.renameKeyInAllFiles(options.oldKey, options.newKey);
console.log(`\nTotal renames performed: ${renames}`);
