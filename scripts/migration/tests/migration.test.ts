import { KeyTransformer } from "../keyTransformer";
import { CollisionResolver } from "../collisionResolver";
import { FileProcessor } from "../fileProcessor";
import { Validator } from "../validator";
import { BackupManager } from "../backup";
import { MigrationOrchestrator } from "../migrate";
import {
  KeyMapping,
  StringsFileEntry,
  DEFAULT_MIGRATION_CONFIG,
} from "../types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Test suite for the migration process
 */
describe("Migration System Tests", () => {
  let tempDir: string;
  let testProjectRoot: string;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-test-"));
    testProjectRoot = path.join(tempDir, "test-project");
    setupTestProject();
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("KeyTransformer", () => {
    it("should transform simple keys correctly", () => {
      const entries: StringsFileEntry[] = [
        { key: "hello", value: "Hello" },
        { key: "world", value: "World" },
        { key: "app_name", value: "CasaZurich" },
      ];

      const mappings = KeyTransformer.transformKeys(entries);

      expect(mappings).toHaveLength(3);
      expect(mappings[0]).toEqual({
        oldKey: "hello",
        newKey: "Hello",
        englishValue: "Hello",
        hasFormatSpecifiers: false,
        hasParameters: false,
        swiftIdentifier: "hello",
      });
    });

    it("should handle format specifiers", () => {
      const entries: StringsFileEntry[] = [
        { key: "welcome_message", value: "Welcome %@" },
        { key: "count_message", value: "You have %d items" },
      ];

      const mappings = KeyTransformer.transformKeys(entries);

      expect(mappings[0].hasFormatSpecifiers).toBe(true);
      expect(mappings[1].hasFormatSpecifiers).toBe(true);
    });

    it("should handle parameters", () => {
      const entries: StringsFileEntry[] = [
        {
          key: "location_message",
          value: "Get ${location} in ${applicationName}",
        },
      ];

      const mappings = KeyTransformer.transformKeys(entries);

      expect(mappings[0].hasParameters).toBe(true);
    });

    it("should generate valid Swift identifiers", () => {
      const entries: StringsFileEntry[] = [
        { key: "special_chars", value: "Hello, World!" },
        { key: "numbers", value: "123 Test" },
        { key: "class_keyword", value: "class" },
      ];

      const mappings = KeyTransformer.transformKeys(entries);

      expect(mappings[0].swiftIdentifier).toBe("helloWorld");
      expect(mappings[1].swiftIdentifier).toBe("_123Test");
      expect(mappings[2].swiftIdentifier).toBe("`class`");
    });

    it("should escape strings correctly", () => {
      const testString = 'Hello "World" with \n newlines';
      const escapedForStrings = KeyTransformer.escapeForStrings(testString);
      const escapedForJSON = KeyTransformer.escapeForJSON(testString);

      expect(escapedForStrings).toBe('Hello \\"World\\" with \\n newlines');
      expect(escapedForJSON).toBe('Hello \\"World\\" with \\n newlines');
    });

    it("should validate keys properly", () => {
      const validKey = "Valid key";
      const invalidKey = "";
      const longKey = "a".repeat(201);

      const validResult = KeyTransformer.validateKey(validKey);
      const invalidResult = KeyTransformer.validateKey(invalidKey);
      const longResult = KeyTransformer.validateKey(longKey);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(longResult.isValid).toBe(false);
    });
  });

  describe("CollisionResolver", () => {
    it("should detect no collisions when all keys are unique", () => {
      const mappings: KeyMapping[] = [
        createTestMapping("key1", "Value 1"),
        createTestMapping("key2", "Value 2"),
        createTestMapping("key3", "Value 3"),
      ];

      const { resolvedMappings, collisions } =
        CollisionResolver.resolveCollisions(mappings);

      expect(collisions).toHaveLength(0);
      expect(resolvedMappings).toHaveLength(3);
    });

    it("should resolve collisions by adding suffixes", () => {
      const mappings: KeyMapping[] = [
        createTestMapping("key1", "Same Value"),
        createTestMapping("key2", "Same Value"),
        createTestMapping("key3", "Different Value"),
      ];

      const { resolvedMappings, collisions } =
        CollisionResolver.resolveCollisions(mappings);

      expect(collisions).toHaveLength(1);
      expect(resolvedMappings).toHaveLength(3);
      expect(resolvedMappings[0].newKey).toBe("Same Value");
      expect(resolvedMappings[1].newKey).toBe("Same Value_2");
      expect(resolvedMappings[2].newKey).toBe("Different Value");
    });

    it("should validate resolution results", () => {
      const mappings: KeyMapping[] = [
        createTestMapping("key1", "Value 1"),
        createTestMapping("key2", "Value 2"),
      ];

      const result = CollisionResolver.validateResolution(mappings);

      expect(result.isValid).toBe(true);
      expect(result.duplicateKeys).toHaveLength(0);
    });
  });

  describe("Validator", () => {
    it("should validate strings file syntax", () => {
      const validContent = '"key1" = "value1";\n"key2" = "value2";';
      const invalidContent = "invalid syntax";

      // Create temporary files
      const validFile = path.join(tempDir, "valid.strings");
      const invalidFile = path.join(tempDir, "invalid.strings");

      fs.writeFileSync(validFile, validContent);
      fs.writeFileSync(invalidFile, invalidContent);

      const validResult = Validator.validateStringsFile(validFile);
      const invalidResult = Validator.validateStringsFile(invalidFile);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    it("should validate JSON file format", () => {
      const validContent = '{"key1": "value1", "key2": "value2"}';
      const invalidContent = '{"key1": "value1", "key2": 123}';

      const validFile = path.join(tempDir, "valid.json");
      const invalidFile = path.join(tempDir, "invalid.json");

      fs.writeFileSync(validFile, validContent);
      fs.writeFileSync(invalidFile, invalidContent);

      const validResult = Validator.validateJSONFile(validFile);
      const invalidResult = Validator.validateJSONFile(invalidFile);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    it("should validate XCStrings file format", () => {
      const validContent = {
        sourceLanguage: "en",
        strings: {
          key1: {
            localizations: {
              en: { stringUnit: { state: "translated", value: "value1" } },
            },
          },
        },
        version: "1.0",
      };

      const invalidContent = {
        strings: {
          key1: {
            localizations: {
              en: { stringUnit: { value: "value1" } }, // missing state
            },
          },
        },
      };

      const validFile = path.join(tempDir, "valid.xcstrings");
      const invalidFile = path.join(tempDir, "invalid.xcstrings");

      fs.writeFileSync(validFile, JSON.stringify(validContent));
      fs.writeFileSync(invalidFile, JSON.stringify(invalidContent));

      const validResult = Validator.validateXCStringsFile(validFile);
      const invalidResult = Validator.validateXCStringsFile(invalidFile);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe("BackupManager", () => {
    it("should create and restore backups", async () => {
      const backupPath = await BackupManager.createBackup(testProjectRoot);

      expect(fs.existsSync(backupPath)).toBe(true);

      // Modify original files
      const originalFile = path.join(
        testProjectRoot,
        "Sources/CasaZurigol10n/Resources/en.lproj/Localizable.strings",
      );
      fs.writeFileSync(originalFile, "modified content");

      // Restore backup
      await BackupManager.restoreBackup(testProjectRoot, backupPath);

      // Check if original content is restored
      const restoredContent = fs.readFileSync(originalFile, "utf8");
      expect(restoredContent).toContain('"test_key" = "Test Value"');
    });

    it("should list backups", async () => {
      const backupPath1 = await BackupManager.createBackup(testProjectRoot);
      const backupPath2 = await BackupManager.createBackup(testProjectRoot);

      const backups = await BackupManager.listBackups(testProjectRoot);

      expect(backups.length).toBeGreaterThanOrEqual(2);
      expect(backups[0].path).toBe(backupPath2); // Most recent first
    });

    it("should verify backup integrity", async () => {
      const backupPath = await BackupManager.createBackup(testProjectRoot);

      const result = await BackupManager.verifyBackupIntegrity(backupPath);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("FileProcessor", () => {
    it("should process strings files correctly", async () => {
      const keyMappings: KeyMapping[] = [
        createTestMapping("test_key", "Test Value"),
        createTestMapping("another_key", "Another Value"),
      ];

      const stringsFile = path.join(
        testProjectRoot,
        "Sources/CasaZurigol10n/Resources/en.lproj/Localizable.strings",
      );

      const result = await FileProcessor.processStringsFile(
        stringsFile,
        keyMappings,
        DEFAULT_MIGRATION_CONFIG,
      );

      expect(result.success).toBe(true);
      expect(result.keysProcessed).toBe(2);

      // Check file content
      const content = fs.readFileSync(stringsFile, "utf8");
      expect(content).toContain('"Test Value" = "Test Value"');
      expect(content).toContain('"Another Value" = "Another Value"');
    });

    it("should process JSON files correctly", async () => {
      const keyMappings: KeyMapping[] = [
        createTestMapping("test_key", "Test Value"),
      ];

      const jsonFile = path.join(
        testProjectRoot,
        "Sources/CasaZurigol10n/Resources/en.lproj/Localizable.json",
      );

      const result = await FileProcessor.processJSONFile(
        jsonFile,
        keyMappings,
        DEFAULT_MIGRATION_CONFIG,
      );

      expect(result.success).toBe(true);
      expect(result.keysProcessed).toBe(1);

      // Check file content
      const content = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
      expect(content["Test Value"]).toBe("Test Value");
    });

    it("should process XCStrings files correctly", async () => {
      const keyMappings: KeyMapping[] = [
        createTestMapping("test_key", "Test Value"),
      ];

      const xcstringsFile = path.join(
        testProjectRoot,
        "Sources/CasaZurigol10n/Resources/Localizable.xcstrings",
      );

      const result = await FileProcessor.processXCStringsFile(
        xcstringsFile,
        keyMappings,
        DEFAULT_MIGRATION_CONFIG,
      );

      expect(result.success).toBe(true);
      expect(result.keysProcessed).toBe(1);

      // Check file content
      const content = JSON.parse(fs.readFileSync(xcstringsFile, "utf8"));
      expect(content.strings["Test Value"]).toBeDefined();
    });
  });

  describe("MigrationOrchestrator", () => {
    it("should perform dry run without modifying files", async () => {
      const migrator = new MigrationOrchestrator(testProjectRoot, {
        dryRun: true,
      });

      const result = await migrator.dryRun();

      expect(result.success).toBe(true);

      // Verify files were not modified
      const originalContent = fs.readFileSync(
        path.join(
          testProjectRoot,
          "Sources/CasaZurigol10n/Resources/en.lproj/Localizable.strings",
        ),
        "utf8",
      );
      expect(originalContent).toContain('"test_key" = "Test Value"');
    });

    it("should perform full migration successfully", async () => {
      const migrator = new MigrationOrchestrator(testProjectRoot, {
        backupEnabled: true,
      });

      const result = await migrator.migrate();

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(result.processedFiles.length).toBeGreaterThan(0);

      // Verify files were modified
      const modifiedContent = fs.readFileSync(
        path.join(
          testProjectRoot,
          "Sources/CasaZurigol10n/Resources/en.lproj/Localizable.strings",
        ),
        "utf8",
      );
      expect(modifiedContent).toContain('"Test Value" = "Test Value"');
    });
  });

  // Helper functions
  function createTestMapping(oldKey: string, newKey: string): KeyMapping {
    return {
      oldKey,
      newKey,
      englishValue: newKey,
      hasFormatSpecifiers: false,
      hasParameters: false,
      swiftIdentifier: KeyTransformer.generateSwiftIdentifier(newKey),
    };
  }

  function setupTestProject() {
    // Create project structure
    const resourcesDir = path.join(
      testProjectRoot,
      "Sources/CasaZurigol10n/Resources",
    );
    const enDir = path.join(resourcesDir, "en.lproj");
    const deDir = path.join(resourcesDir, "de.lproj");

    fs.mkdirSync(enDir, { recursive: true });
    fs.mkdirSync(deDir, { recursive: true });

    // Create test files
    const testStringsContent =
      '"test_key" = "Test Value";\n"another_key" = "Another Value";';
    const testJSONContent =
      '{"test_key": "Test Value", "another_key": "Another Value"}';
    const testXCStringsContent = {
      sourceLanguage: "en",
      strings: {
        test_key: {
          localizations: {
            en: { stringUnit: { state: "translated", value: "Test Value" } },
            de: { stringUnit: { state: "translated", value: "Test Wert" } },
          },
        },
      },
      version: "1.0",
    };

    // Write English files
    fs.writeFileSync(
      path.join(enDir, "Localizable.strings"),
      testStringsContent,
    );
    fs.writeFileSync(path.join(enDir, "Localizable.json"), testJSONContent);
    fs.writeFileSync(
      path.join(enDir, "InfoPlist.strings"),
      '"CFBundleName" = "TestApp";',
    );
    fs.writeFileSync(
      path.join(enDir, "InfoPlist.json"),
      '{"CFBundleName": "TestApp"}',
    );
    fs.writeFileSync(
      path.join(enDir, "AppShortcuts.strings"),
      '"Get \${location}" = "Get \${location}";',
    );
    fs.writeFileSync(
      path.join(enDir, "AppShortcuts.json"),
      '{"Get ${location}": "Get ${location}"}',
    );

    // Write German files
    fs.writeFileSync(
      path.join(deDir, "Localizable.strings"),
      '"test_key" = "Test Wert";\n"another_key" = "Anderer Wert";',
    );
    fs.writeFileSync(
      path.join(deDir, "Localizable.json"),
      '{"test_key": "Test Wert", "another_key": "Anderer Wert"}',
    );
    fs.writeFileSync(
      path.join(deDir, "InfoPlist.strings"),
      '"CFBundleName" = "TestApp";',
    );
    fs.writeFileSync(
      path.join(deDir, "InfoPlist.json"),
      '{"CFBundleName": "TestApp"}',
    );
    fs.writeFileSync(
      path.join(deDir, "AppShortcuts.strings"),
      '"Get \${location}" = "Finde \${location}";',
    );
    fs.writeFileSync(
      path.join(deDir, "AppShortcuts.json"),
      '{"Get ${location}": "Finde ${location}"}',
    );

    // Write XCStrings files
    fs.writeFileSync(
      path.join(resourcesDir, "Localizable.xcstrings"),
      JSON.stringify(testXCStringsContent, null, 2),
    );
    fs.writeFileSync(
      path.join(resourcesDir, "InfoPlist.xcstrings"),
      JSON.stringify(
        {
          sourceLanguage: "en",
          strings: {
            CFBundleName: {
              localizations: {
                en: { stringUnit: { state: "translated", value: "TestApp" } },
                de: { stringUnit: { state: "translated", value: "TestApp" } },
              },
            },
          },
          version: "1.0",
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(resourcesDir, "AppShortcuts.xcstrings"),
      JSON.stringify(
        {
          sourceLanguage: "en",
          strings: {
            "Get ${location}": {
              localizations: {
                en: {
                  stringUnit: { state: "translated", value: "Get ${location}" },
                },
                de: {
                  stringUnit: {
                    state: "translated",
                    value: "Finde ${location}",
                  },
                },
              },
            },
          },
          version: "1.0",
        },
        null,
        2,
      ),
    );
  }
});
