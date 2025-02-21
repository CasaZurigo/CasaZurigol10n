import { Command } from 'commander';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { FileHandlerFactory } from './fileHandlers';
import { SourceLanguageCode, TargetLanguageCode, Translator } from 'deepl-node';

config();

class StringsTranslator {
    private translator: Translator;
    private cache: Record<string, string> = {};

    constructor(authKey: string, sourceLang: string) {
        this.translator = new Translator(authKey);
    }

    private isInfoPlist(filePath: string): boolean {
        return path.basename(filePath).toLowerCase().includes('InfoPlist'.toLowerCase());
    }

    private isAppShortcuts(filePath: string): boolean {
        return path.basename(filePath).toLowerCase().includes('AppShortcuts'.toLowerCase());
    }

    private async translateStrings(
        sourceTranslations: Record<string, string>,
        targetTranslations: Record<string, string>,
        sourceLanguage: string,
        targetLanguage: string,
        shouldSerializeKeys: boolean
    ): Promise<Record<string, string>> {
        const translated = { ...targetTranslations };
        let missingTranslations: Record<string, string>;

        if (shouldSerializeKeys) {
            const sourceLower = Object.fromEntries(
                Object.entries(sourceTranslations).map(([k, v]) => [k.toLowerCase(), v])
            );
            const targetKeys = new Set(Object.keys(targetTranslations).map(k => k.toLowerCase()));
            missingTranslations = Object.fromEntries(
                Object.entries(sourceLower).filter(([k]) => !targetKeys.has(k))
            );
        } else {
            missingTranslations = Object.fromEntries(
                Object.entries(sourceTranslations).filter(([k]) => !(k in targetTranslations))
            );
        }

        if (Object.keys(missingTranslations).length > 0) {
            console.log(
                `Translating ${Object.keys(missingTranslations).length} missing strings to ${targetLanguage}...`
            );

            const total = Object.keys(missingTranslations).length;
            let i = 1;

            for (const [key, value] of Object.entries(missingTranslations)) {
                const cacheKey = `${value}:${targetLanguage}`;
                
                if (cacheKey in this.cache) {
                    translated[key] = this.cache[cacheKey];
                } else {
                    try {
                        const result = await this.translator.translateText(
                            value,
                            sourceLanguage.toLowerCase() as SourceLanguageCode,
                            targetLanguage.toLowerCase() as TargetLanguageCode
                        );
                        translated[key] = result.text;
                        this.cache[cacheKey] = result.text;
                        await new Promise(resolve => setTimeout(resolve, 500)); // Sleep for 500ms
                    } catch (e) {
                        console.error(`Error translating '${key}': ${e}`);
                        translated[key] = value;
                    }
                }
                console.log(`Progress: ${i}/${total} (${Math.floor((i/total)*100)}%)`);
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
        outputDir: string = 'translations'
    ): Promise<void> {
        for (const inputFile of inputFiles) {
            const isInfoPlist = this.isInfoPlist(inputFile);
            const isAppShortcuts = this.isAppShortcuts(inputFile);
            const handler = FileHandlerFactory.getHandler(inputFile);
            const sourceTranslations = handler.parseFile(inputFile);
            
            const inputFilename = path.basename(inputFile);
            const inputStem = path.parse(inputFile).name;
            
            const totalStrings = Object.keys(sourceTranslations).length;
            const totalChars = Object.values(sourceTranslations)
                .reduce((sum, value) => sum + value.length, 0);

            console.log(`\nProcessing source file: ${inputFile}`);
            console.log(`Total strings: ${totalStrings}`);
            console.log(`Total characters: ${totalChars}`);
            console.log(
                `Will translate ${totalStrings * targetLanguages.length} strings & ` +
                `${totalChars * targetLanguages.length} characters`
            );

            for (const lang of targetLanguages) {
                console.log(`\nProcessing ${lang} for ${inputFilename}...`);

                const stringsHandler = FileHandlerFactory.getStringsFileHandler();
                const jsonHandler = FileHandlerFactory.getJsonFileHandler();
                const stringsOutputFile = path.join(outputDir, `${lang}.lproj`, `${inputStem}.strings`);
                const jsonOutputFile = path.join(outputDir, `${lang}.lproj`, `${inputStem}.json`);

                let existingStringsTranslations = {};
                let existingJsonTranslations = {};

                if (fs.existsSync(stringsOutputFile)) {
                    existingStringsTranslations = stringsHandler.parseFile(stringsOutputFile);
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
                    shouldSerializeKeys
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
    .option('--auth-key <key>', 'DeepL API authentication key', process.env.DEEPL_AUTH_KEY)
    .option('--source-lang <lang>', 'Source language code', process.env.SOURCE_LANG || 'en')
    .option('--target-langs <langs...>', 'Target language codes', process.env.TARGET_LANG?.split(',') || ['fr', 'it', 'es', 'pt-PT', 'tr', 'de', 'en'])
    .option('--input-dir <dir>', 'Input directory', './Sources/CasaZurigol10n/Resources')
    .option('--output-dir <dir>', 'Output directory', './Sources/CasaZurigol10n/Resources')
    .parse(process.argv);

const options = program.opts();

if (!options.authKey) {
    throw new Error(
        'DeepL authentication key is required. Provide it via --auth-key or DEEPL_AUTH_KEY environment variable'
    );
}


const sourceLangDir = path.join(options.inputDir, `${options.sourceLang}.lproj`);
const inputFiles = fs.readdirSync(sourceLangDir)
    .filter(f => f.endsWith('.strings'))
    .map(f => path.join(sourceLangDir, f));

const translator = new StringsTranslator(options.authKey, options.sourceLang);

translator.translateToLanguages(
    inputFiles,
    options.sourceLang,
    options.targetLangs,
    options.outputDir
).catch(error => {
    console.error('Translation failed:', error);
    process.exit(1);
});