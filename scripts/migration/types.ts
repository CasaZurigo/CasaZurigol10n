/**
 * Core types for the localization key migration system
 */

export interface KeyMapping {
  oldKey: string;
  newKey: string;
  englishValue: string;
  hasFormatSpecifiers: boolean;
  hasParameters: boolean;
  swiftIdentifier: string;
}

export interface MigrationResult {
  success: boolean;
  error?: string;
  processedFiles: string[];
  backupPath?: string;
}

export interface FileProcessingResult {
  success: boolean;
  filePath: string;
  error?: string;
  keysProcessed: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface StringsFileEntry {
  key: string;
  value: string;
  comment?: string;
}

export interface XCStringsEntry {
  key: string;
  localizations: Record<
    string,
    {
      stringUnit: {
        state: string;
        value: string;
      };
    }
  >;
}

export interface MigrationConfig {
  sourceLanguage: string;
  supportedLanguages: string[];
  backupEnabled: boolean;
  dryRun: boolean;
  validateOnly: boolean;
}

export interface CollisionInfo {
  originalKey: string;
  englishValue: string;
  newKey: string;
  conflictCount: number;
}

export const DEFAULT_MIGRATION_CONFIG: MigrationConfig = {
  sourceLanguage: "en",
  supportedLanguages: ["en", "de", "fr", "it", "es", "pt-PT", "tr"],
  backupEnabled: true,
  dryRun: false,
  validateOnly: false,
};
