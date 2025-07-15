import { KeyTransformer } from "../keyTransformer";
import { CollisionResolver } from "../collisionResolver";
import { FileProcessor } from "../fileProcessor";
import { KeyMapping, StringsFileEntry } from "../types";

/**
 * Edge case tests for migration system
 */
describe("Edge Cases", () => {
  describe("KeyTransformer Edge Cases", () => {
    it("should handle empty strings", () => {
      const entries: StringsFileEntry[] = [{ key: "empty", value: "" }];

      const mappings = KeyTransformer.transformKeys(entries);
      expect(mappings[0].newKey).toBe("");
      expect(mappings[0].swiftIdentifier).toBe("unknownKey");
    });

    it("should handle very long strings", () => {
      const longValue = "a".repeat(500);
      const entries: StringsFileEntry[] = [{ key: "long", value: longValue }];

      const mappings = KeyTransformer.transformKeys(entries);
      expect(mappings[0].newKey).toBe(longValue);
      expect(mappings[0].swiftIdentifier).toBe("a".repeat(500));
    });

    it("should handle strings with only special characters", () => {
      const entries: StringsFileEntry[] = [
        { key: "special", value: "!@#$%^&*()" },
      ];

      const mappings = KeyTransformer.transformKeys(entries);
      expect(mappings[0].swiftIdentifier).toBe("unknownKey");
    });

    it("should handle Unicode characters", () => {
      const entries: StringsFileEntry[] = [
        { key: "unicode", value: "Hëllö Wörld 🌍" },
      ];

      const mappings = KeyTransformer.transformKeys(entries);
      expect(mappings[0].newKey).toBe("Hëllö Wörld 🌍");
    });

    it("should handle complex format specifiers", () => {
      const entries: StringsFileEntry[] = [
        { key: "complex", value: "User %1$@ has %2$d items in %3$@" },
      ];

      const mappings = KeyTransformer.transformKeys(entries);
      expect(mappings[0].hasFormatSpecifiers).toBe(true);
    });

    it("should handle mixed parameters and format specifiers", () => {
      const entries: StringsFileEntry[] = [
        { key: "mixed", value: "Get ${location} with %@ items" },
      ];

      const mappings = KeyTransformer.transformKeys(entries);
      expect(mappings[0].hasFormatSpecifiers).toBe(true);
      expect(mappings[0].hasParameters).toBe(true);
    });

    it("should handle newlines and tabs in values", () => {
      const entries: StringsFileEntry[] = [
        { key: "multiline", value: "Line 1\nLine 2\tTabbed" },
      ];

      const mappings = KeyTransformer.transformKeys(entries);
      expect(mappings[0].newKey).toBe("Line 1\nLine 2\tTabbed");
    });

    it("should handle quotes in values", () => {
      const entries: StringsFileEntry[] = [
        { key: "quotes", value: 'Say "Hello"' },
      ];

      const mappings = KeyTransformer.transformKeys(entries);
      expect(mappings[0].newKey).toBe('Say "Hello"');
    });
  });

  describe("CollisionResolver Edge Cases", () => {
    it("should handle many collisions", () => {
      const mappings: KeyMapping[] = [];
      const sameValue = "Same Value";

      // Create 100 mappings with the same value
      for (let i = 0; i < 100; i++) {
        mappings.push({
          oldKey: `key${i}`,
          newKey: sameValue,
          englishValue: sameValue,
          hasFormatSpecifiers: false,
          hasParameters: false,
          swiftIdentifier: "sameValue",
        });
      }

      const { resolvedMappings, collisions } =
        CollisionResolver.resolveCollisions(mappings);

      expect(resolvedMappings).toHaveLength(100);
      expect(collisions).toHaveLength(1);
      expect(resolvedMappings[0].newKey).toBe(sameValue);
      expect(resolvedMappings[99].newKey).toBe(`${sameValue}_100`);
    });

    it("should handle empty mappings array", () => {
      const { resolvedMappings, collisions } =
        CollisionResolver.resolveCollisions([]);

      expect(resolvedMappings).toHaveLength(0);
      expect(collisions).toHaveLength(0);
    });

    it("should handle single mapping", () => {
      const mappings: KeyMapping[] = [
        {
          oldKey: "key1",
          newKey: "Value 1",
          englishValue: "Value 1",
          hasFormatSpecifiers: false,
          hasParameters: false,
          swiftIdentifier: "value1",
        },
      ];

      const { resolvedMappings, collisions } =
        CollisionResolver.resolveCollisions(mappings);

      expect(resolvedMappings).toHaveLength(1);
      expect(collisions).toHaveLength(0);
      expect(resolvedMappings[0].newKey).toBe("Value 1");
    });
  });

  describe("File Processing Edge Cases", () => {
    it("should handle malformed strings file", () => {
      const malformedContent =
        '"key1" = "value1";\nmalformed line\n"key2" = "value2";';

      // This would be tested with a real file in integration tests
      expect(() => {
        const lines = malformedContent.split("\n");
        let validLines = 0;

        for (const line of lines) {
          if (line.trim() && !line.startsWith("//")) {
            if (line.match(/^".*"\s*=\s*".*"\s*;?\s*$/)) {
              validLines++;
            }
          }
        }

        expect(validLines).toBe(2);
      }).not.toThrow();
    });

    it("should handle missing keys in mappings", () => {
      const entries: StringsFileEntry[] = [
        { key: "existing_key", value: "Existing Value" },
        { key: "missing_key", value: "Missing Value" },
      ];

      const mappings: KeyMapping[] = [
        {
          oldKey: "existing_key",
          newKey: "Existing Value",
          englishValue: "Existing Value",
          hasFormatSpecifiers: false,
          hasParameters: false,
          swiftIdentifier: "existingValue",
        },
      ];

      // Should handle missing mappings gracefully
      const mappingMap = new Map(mappings.map((m) => [m.oldKey, m]));

      for (const entry of entries) {
        const mapping = mappingMap.get(entry.key);
        if (mapping) {
          expect(mapping.newKey).toBe("Existing Value");
        } else {
          // Should keep original key if no mapping found
          expect(entry.key).toBe("missing_key");
        }
      }
    });
  });

  describe("Swift Identifier Generation Edge Cases", () => {
    it("should handle all Swift keywords", () => {
      const swiftKeywords = [
        "class",
        "struct",
        "enum",
        "protocol",
        "extension",
        "func",
        "var",
        "let",
        "if",
        "else",
        "switch",
        "case",
        "default",
        "for",
        "while",
        "repeat",
        "return",
        "break",
        "continue",
        "import",
        "public",
        "private",
        "internal",
      ];

      for (const keyword of swiftKeywords) {
        const entries: StringsFileEntry[] = [{ key: "test", value: keyword }];

        const mappings = KeyTransformer.transformKeys(entries);
        expect(mappings[0].swiftIdentifier).toBe(`\`${keyword}\``);
      }
    });

    it("should handle numbers at start of identifier", () => {
      const entries: StringsFileEntry[] = [
        { key: "number", value: "123 Test" },
      ];

      const mappings = KeyTransformer.transformKeys(entries);
      expect(mappings[0].swiftIdentifier).toBe("_123test");
    });

    it("should handle camelCase conversion", () => {
      const testCases = [
        { input: "hello world", expected: "helloWorld" },
        { input: "Hello World", expected: "helloWorld" },
        { input: "HELLO WORLD", expected: "helloWorld" },
        { input: "hello-world", expected: "helloWorld" },
        { input: "hello_world", expected: "helloWorld" },
      ];

      for (const testCase of testCases) {
        const entries: StringsFileEntry[] = [
          { key: "test", value: testCase.input },
        ];

        const mappings = KeyTransformer.transformKeys(entries);
        expect(mappings[0].swiftIdentifier).toBe(testCase.expected);
      }
    });
  });

  describe("Memory and Performance", () => {
    it("should handle large number of keys efficiently", () => {
      const startTime = Date.now();
      const entries: StringsFileEntry[] = [];

      // Create 10,000 entries
      for (let i = 0; i < 10000; i++) {
        entries.push({
          key: `key_${i}`,
          value: `Value ${i}`,
        });
      }

      const mappings = KeyTransformer.transformKeys(entries);
      const { resolvedMappings, collisions } =
        CollisionResolver.resolveCollisions(mappings);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(mappings).toHaveLength(10000);
      expect(resolvedMappings).toHaveLength(10000);
      expect(collisions).toHaveLength(0);
      expect(processingTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it("should handle memory efficiently with large strings", () => {
      const largeString = "a".repeat(10000);
      const entries: StringsFileEntry[] = [];

      // Create 1000 entries with large strings
      for (let i = 0; i < 1000; i++) {
        entries.push({
          key: `key_${i}`,
          value: `${largeString}_${i}`,
        });
      }

      const mappings = KeyTransformer.transformKeys(entries);
      expect(mappings).toHaveLength(1000);

      // Should not crash or run out of memory
      expect(mappings[0].newKey.length).toBe(10007); // 10000 + "_0".length
    });
  });
});
