import { Command } from "commander";
import { config } from "dotenv";
import path from "path";
import fs from "fs";
import { FileHandlerFactory } from "./fileHandlers";
import { SourceLanguageCode, TargetLanguageCode, Translator } from "deepl-node";
import { streamText } from "ai";
import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { FileSynchronizer } from "./fileSync";
import { normalizeString } from "./utils";

const context = `
CasaZurigo: Your Go-To Guide for Zurich

Welcome to CasaZurigo, your insider's guide to Zurich, designed by me, a local, for both residents and newcomers. Navigate Zurich confidently and uncover the essential conveniences that simplify city living.

Effortless City Navigation:
With CasaZurigo, key city spots are at your fingertips thanks to iOS Widget and Shortcuts integration. Finding ATMs, postal boxes, or recycling stations is hassle-free, accessible right from your home screen.

Streamlined Recycling:
Join me in making Zurich cleaner with CasaZurigo's detailed recycling resources. Pinpoint collection points for materials like glass, metal, and oil, discover recycling events, and do your part for a sustainable city.

Vital City Services:
No more searching in vain. CasaZurigo directs you to public toilets, drinking fountains, ATMs, and vending machines effortlessly. Upgrade to PRO for an extensive network, including bank ATMs and postal boxes.

Ongoing Updates, Local Expertise:
As a Zurich local, I consistently enrich our database with updates and insights. Trust CasaZurigo for accurate, up-to-date information about the city you love.

Let CasaZurigo transform your Zurich experience. Discover a smarter way to navigate your city with me by your side.
`;

config();

class StringsTranslator {
  private translator: Translator;
  private cache: Record<string, string> = {};
  private openRouter: OpenRouterProvider;
  private aiModel: string;
  private fileSynchronizer: FileSynchronizer;

  constructor(
    deeplKey: string,
    openRouterKey: string | undefined,
    aiModel: string,
  ) {
    this.translator = new Translator(deeplKey);
    this.openRouter = createOpenRouter({
      apiKey: openRouterKey,
    });
    this.aiModel = aiModel;
    this.fileSynchronizer = new FileSynchronizer();
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
  ): Promise<string> {
    try {
      const systemPrompt = `
            You are a translation assistant specialized in mobile app interfaces. 
            Context: You're refining translations for the CasaZurigo app.
            Additional app context: ${context}

            Your task is to:
            - Ensure translations align with standard mobile UI/UX terminology
            - Maintain consistent tone and meaning across the app interface
            - Consider cultural nuances in ${targetLanguage}

            Provide only the refined translation without any explanation.
            Never return the refined translation in quotes.
            Only return the refined translation nothing else additionally.
        `;

      const prompt = `
            Original text: "${originalText}"
            DeepL translation: "${translatedText}"
            Source language: ${sourceLanguage}
            Target language: ${targetLanguage}
            
            Please provide a refined translation that:
            1. Maintain original meaning
            2. Using region-specific terminology if necessary
            3. Ensuring natural flow in the target language
            4. Adapting formal/informal speech appropriately
        `;

      const result = streamText({
        model: this.openRouter(this.aiModel),
        prompt,
        system: systemPrompt,
      });

      const refinedTranslation = await result.toTextStreamResponse().text();
      return refinedTranslation;
    } catch (error) {
      console.warn(`AI refinement failed: ${error}`);
      return translatedText;
    }
  }

  private async translateStrings(
    sourceTranslations: Record<string, string>,
    targetTranslations: Record<string, string>,
    sourceLanguage: string,
    targetLanguage: string,
    shouldSerializeKeys: boolean,
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
            const deeplTranslation = await this.translator.translateText(
              value,
              sourceLanguage.toLowerCase() as SourceLanguageCode,
              targetLanguage.toLowerCase() as TargetLanguageCode,
            );

            // Then, refine it with AI
            const refinedTranslation = await this.refineTranslationWithAI(
              value,
              sourceLanguage,
              deeplTranslation.text,
              targetLanguage,
            );

            const normalisedTranslation = normalizeString(
              refinedTranslation || deeplTranslation.text,
            );
            const result = normalisedTranslation;

            translated[key] = result;
            this.cache[cacheKey] = result;
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
    ignoreAllTranslations: boolean = false,
    outputDir: string = "translations",
    key: string | undefined = undefined,
  ): Promise<void> {
    // Sync source language files first
    await this.fileSynchronizer.syncFiles(outputDir, [sourceLanguage]);

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

        let existingStringsTranslations: Record<string, string> = {};
        let existingJsonTranslations: Record<string, string> = {};

        if (!ignoreAllTranslations) {
          if (fs.existsSync(stringsOutputFile)) {
            existingStringsTranslations =
              stringsHandler.parseFile(stringsOutputFile);
          }
          if (fs.existsSync(jsonOutputFile)) {
            existingJsonTranslations = jsonHandler.parseFile(jsonOutputFile);
          }
        }

        const existingTranslations: Record<string, string> = {
          ...existingJsonTranslations,
          ...existingStringsTranslations,
        };

        if (key && key in existingTranslations) {
          delete existingTranslations[key];
        }

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

    // Sync all target language files after translation
    await this.fileSynchronizer.syncFiles(outputDir, targetLanguages);

    // Generate .xcstrings files after translation
    await this.generateXCStringsFiles(inputFiles, outputDir, targetLanguages);
  }

  private async generateXCStringsFiles(
    inputFiles: string[],
    outputDir: string,
    targetLanguages: string[],
  ): Promise<void> {
    const xcstringsHandler = FileHandlerFactory.getXCStringsFileHandler();
    const stringsHandler = FileHandlerFactory.getStringsFileHandler();
    const allLanguages = ["en", ...targetLanguages];

    for (const inputFile of inputFiles) {
      const inputStem = path.parse(inputFile).name;
      const xcstringsOutputFile = path.join(
        outputDir,
        `${inputStem}.xcstrings`,
      );

      console.log(`\nGenerating .xcstrings file: ${xcstringsOutputFile}`);

      // Collect all translations for all languages
      const allLanguageTranslations: Record<
        string,
        Record<string, string>
      > = {};

      for (const language of allLanguages) {
        const stringsFile = path.join(
          outputDir,
          `${language}.lproj`,
          `${inputStem}.strings`,
        );
        if (fs.existsSync(stringsFile)) {
          allLanguageTranslations[language] =
            stringsHandler.parseFile(stringsFile);
        }
      }

      // Generate .xcstrings file with all translations
      xcstringsHandler.syncWithTranslations(
        xcstringsOutputFile,
        allLanguageTranslations,
      );

      console.log(`Created/Updated ${xcstringsOutputFile}`);
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
    process.env.AI_MODEL || "google/gemini-2.5-flash-preview",
  )
  .option(
    "--ignore-all-translations",
    "Ignore all existing translations in target-langs",
    false,
  )
  .option("--key <key>", "Translate a specific key only")
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
    options.ignoreAllTranslations,
    options.outputDir,
    options.key,
  )
  .catch((error) => {
    console.error("Translation failed:", error);
    process.exit(1);
  });
