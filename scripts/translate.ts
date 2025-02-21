import { Command } from "commander";
import { config } from "dotenv";
import path from "path";
import fs from "fs";
import { FileHandlerFactory } from "./fileHandlers";
import { SourceLanguageCode, TargetLanguageCode, Translator } from "deepl-node";
import { streamText } from "ai";
import {
  createOpenRouter,
  openrouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { text } from "stream/consumers";

config();

class StringsTranslator {
  private translator: Translator;
  private cache: Record<string, string> = {};
  private openRouter: OpenRouterProvider;
  private aiModel: string;

  constructor(deeplKey: string, openRouterKey: string, aiModel: string) {
    this.translator = new Translator(deeplKey);
    this.openRouter = createOpenRouter({
      apiKey: openRouterKey,
    });
    this.aiModel = aiModel;
  }

  private isInfoPlist(filePath: string): boolean {
    return path
      .basename(filePath)
      .toLowerCase()
      .includes("InfoPlist".toLowerCase());
  }

  private isAppShortcuts(filePath: string): boolean {
    return path
      .basename(filePath)
      .toLowerCase()
      .includes("AppShortcuts".toLowerCase());
  }

  private async refineTranslationWithAI(
    originalText: string,
    sourceLanguage: string,
    translatedText: string,
    targetLanguage: string,
    context: string,
  ): Promise<string> {
    try {
      const prompt = `
            Original text: "${originalText}"
            DeepL translation: "${translatedText}"
            Source language: ${sourceLanguage}
            Target language: ${targetLanguage}
            Context: This is for the CasaZurigo app. The translation should be refined to ensure it makes sense in the app context.
            Additional context: ${context}
            
            Please provide a refined translation that:
            1. Maintains the original meaning
            2. Is appropriate for a mobile app interface
            3. Considers the specific context of CasaZurigo
            4. Keeps consistency with mobile UI/UX terms in ${targetLanguage}
            
            Provide only the refined translation without any explanation.
        `;

      const result = streamText({
        model: this.openRouter(this.aiModel),
        prompt,
      });

      const refinedTranslation = await result.toTextStreamResponse().text();
      return refinedTranslation;
    } catch (error) {
      console.warn(
        `AI refinement failed, using DeepL translation instead: ${error}`,
      );
      return translatedText;
    }
  }

  private async translateStrings(
    sourceTranslations: Record<string, string>,
    targetTranslations: Record<string, string>,
    sourceLanguage: string,
    targetLanguage: string,
    shouldSerializeKeys: boolean,
    context: string = "",
  ): Promise<Record<string, string>> {
    const translated = { ...targetTranslations };
    let missingTranslations: Record<string, string>;

    if (shouldSerializeKeys) {
      const sourceLower = Object.fromEntries(
        Object.entries(sourceTranslations).map(([k, v]) => [
          k.toLowerCase(),
          v,
        ]),
      );
      const targetKeys = new Set(
        Object.keys(targetTranslations).map((k) => k.toLowerCase()),
      );
      missingTranslations = Object.fromEntries(
        Object.entries(sourceLower).filter(([k]) => !targetKeys.has(k)),
      );
    } else {
      missingTranslations = Object.fromEntries(
        Object.entries(sourceTranslations).filter(
          ([k]) => !(k in targetTranslations),
        ),
      );
    }

    if (Object.keys(missingTranslations).length > 0) {
      console.log(
        `Translating ${
          Object.keys(missingTranslations).length
        } missing strings to ${targetLanguage}...`,
      );

      const total = Object.keys(missingTranslations).length;
      let i = 1;

      for (const [key, value] of Object.entries(missingTranslations)) {
        const cacheKey = `${value}:${targetLanguage}`;

        if (cacheKey in this.cache) {
          translated[key] = this.cache[cacheKey];
        } else {
          try {
            // First, get Deepl translation
            const deeplResult = await this.translator.translateText(
              value,
              sourceLanguage.toLowerCase() as SourceLanguageCode,
              targetLanguage.toLowerCase() as TargetLanguageCode,
            );

            // Then, refine it with AI
            const refinedTranslation = await this.refineTranslationWithAI(
              value,
              sourceLanguage,
              deeplResult.text,
              targetLanguage,
              context,
            );

            translated[key] = refinedTranslation;
            this.cache[cacheKey] = refinedTranslation;
            await new Promise((resolve) => setTimeout(resolve, 500)); // Sleep for 500ms
          } catch (e) {
            console.error(`Error translating '${key}': ${e}`);
            translated[key] = value;
          }
        }
        console.log(
          `Progress: ${i}/${total} (${Math.floor((i / total) * 100)}%)`,
        );
        i++;
      }
    } else {
      console.log(`No new strings to translate for ${targetLanguage}`);
    }

    return translated;
  }

  async translateToLanguages(
    inputFiles: string[],
    sourceLanguage: string,
    targetLanguages: string[],
    outputDir: string = "translations",
  ): Promise<void> {
    for (const inputFile of inputFiles) {
      const isInfoPlist = this.isInfoPlist(inputFile);
      const isAppShortcuts = this.isAppShortcuts(inputFile);
      const handler = FileHandlerFactory.getHandler(inputFile);
      const sourceTranslations = handler.parseFile(inputFile);

      const inputFilename = path.basename(inputFile);
      const inputStem = path.parse(inputFile).name;

      const totalStrings = Object.keys(sourceTranslations).length;
      const totalChars = Object.values(sourceTranslations).reduce(
        (sum, value) => sum + value.length,
        0,
      );

      console.log(`\nProcessing source file: ${inputFile}`);
      console.log(`Total strings: ${totalStrings}`);
      console.log(`Total characters: ${totalChars}`);
      console.log(
        `Will translate ${totalStrings * targetLanguages.length} strings & ` +
          `${totalChars * targetLanguages.length} characters`,
      );

      for (const lang of targetLanguages) {
        console.log(`\nProcessing ${lang} for ${inputFilename}...`);

        const stringsHandler = FileHandlerFactory.getStringsFileHandler();
        const jsonHandler = FileHandlerFactory.getJsonFileHandler();
        const stringsOutputFile = path.join(
          outputDir,
          `${lang}.lproj`,
          `${inputStem}.strings`,
        );
        const jsonOutputFile = path.join(
          outputDir,
          `${lang}.lproj`,
          `${inputStem}.json`,
        );

        let existingStringsTranslations = {};
        let existingJsonTranslations = {};

        if (fs.existsSync(stringsOutputFile)) {
          existingStringsTranslations =
            stringsHandler.parseFile(stringsOutputFile);
        }
        if (fs.existsSync(jsonOutputFile)) {
          existingJsonTranslations = jsonHandler.parseFile(jsonOutputFile);
        }

        const existingTranslations = {
          ...existingJsonTranslations,
          ...existingStringsTranslations,
        };

        const shouldSerializeKeys = !(isInfoPlist || isAppShortcuts);

        const translated = await this.translateStrings(
          sourceTranslations,
          existingTranslations,
          sourceLanguage,
          lang,
          shouldSerializeKeys,
        );

        stringsHandler.createFile(translated, stringsOutputFile);
        jsonHandler.createFile(translated, jsonOutputFile);

        console.log(`Created/Updated ${stringsOutputFile}`);
        console.log(`Created/Updated ${jsonOutputFile}`);
      }
    }
  }
}

const program = new Command();

program
  .option(
    "--deepl-key <key>",
    "DeepL API authentication key",
    process.env.DEEPL_AUTH_KEY,
  )
  .option(
    "--openRouter-key <key>",
    "OpenRouter API authentication key",
    process.env.OPENROUTER_AUTH_KEY,
  )
  .option(
    "--source-lang <lang>",
    "Source language code",
    process.env.SOURCE_LANG || "en",
  )
  .option(
    "--target-langs <langs...>",
    "Target language codes",
    process.env.TARGET_LANG?.split(",") || [
      "fr",
      "it",
      "es",
      "pt-PT",
      "tr",
      "de",
      "en",
    ],
  )
  .option(
    "--input-dir <path>",
    "Input directory",
    "./Sources/CasaZurigol10n/Resources",
  )
  .option(
    "--output-dir <path>",
    "Output directory",
    "./Sources/CasaZurigol10n/Resources",
  )
  .option(
    "--ai-model <model>",
    "AI model to use for refinement",
    "meta-llama/llama-3.3-70b-instruct:free",
  )
  .option("--context <context>", "Additional context for AI refinement", "")
  .parse(process.argv);

const options = program.opts();

if (!options.deeplKey) {
  throw new Error(
    "DeepL authentication key is required. Provide it via --auth-key or DEEPL_AUTH_KEY environment variable",
  );
}

const sourceLangDir = path.join(
  options.inputDir,
  `${options.sourceLang}.lproj`,
);
const inputFiles = fs
  .readdirSync(sourceLangDir)
  .filter((f) => f.endsWith(".strings"))
  .map((f) => path.join(sourceLangDir, f));

const translator = new StringsTranslator(
  options.deeplKey,
  options.openRouterKey,
  options.aiModel,
);

translator
  .translateToLanguages(
    inputFiles,
    options.sourceLang,
    options.targetLangs,
    options.outputDir,
  )
  .catch((error) => {
    console.error("Translation failed:", error);
    process.exit(1);
  });
