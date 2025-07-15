import { KeyMapping, CollisionInfo } from "./types";

/**
 * Handles collision resolution when multiple keys map to the same English value
 */
export class CollisionResolver {
  /**
   * Resolve key collisions by appending numeric suffixes
   */
  static resolveCollisions(mappings: KeyMapping[]): {
    resolvedMappings: KeyMapping[];
    collisions: CollisionInfo[];
  } {
    const keyUsageMap = new Map<string, KeyMapping[]>();
    const collisions: CollisionInfo[] = [];

    // Group mappings by their new key (English value)
    for (const mapping of mappings) {
      const newKey = mapping.newKey;
      if (!keyUsageMap.has(newKey)) {
        keyUsageMap.set(newKey, []);
      }
      keyUsageMap.get(newKey)!.push(mapping);
    }

    // Process each group
    const resolvedMappings: KeyMapping[] = [];
    for (const [newKey, groupMappings] of keyUsageMap) {
      if (groupMappings.length === 1) {
        // No collision, use as is
        resolvedMappings.push(groupMappings[0]);
      } else {
        // Collision detected, resolve it
        const resolvedGroup = this.resolveCollisionGroup(groupMappings);
        resolvedMappings.push(...resolvedGroup.mappings);
        collisions.push({
          originalKey: groupMappings[0].oldKey,
          englishValue: newKey,
          newKey: newKey,
          conflictCount: groupMappings.length,
        });
      }
    }

    return {
      resolvedMappings,
      collisions,
    };
  }

  /**
   * Resolve collisions within a group of mappings that share the same English value
   */
  private static resolveCollisionGroup(mappings: KeyMapping[]): {
    mappings: KeyMapping[];
  } {
    const resolvedMappings: KeyMapping[] = [];

    // Sort by original key to ensure deterministic resolution
    const sortedMappings = mappings.sort((a, b) =>
      a.oldKey.localeCompare(b.oldKey),
    );

    for (let i = 0; i < sortedMappings.length; i++) {
      const mapping = sortedMappings[i];

      if (i === 0) {
        // First mapping keeps the original key
        resolvedMappings.push(mapping);
      } else {
        // Subsequent mappings get numeric suffixes
        const resolvedMapping = this.createResolvedMapping(mapping, i + 1);
        resolvedMappings.push(resolvedMapping);
      }
    }

    return { mappings: resolvedMappings };
  }

  /**
   * Create a resolved mapping with numeric suffix
   */
  private static createResolvedMapping(
    mapping: KeyMapping,
    suffix: number,
  ): KeyMapping {
    const newKey = `${mapping.newKey}_${suffix}`;
    const swiftIdentifier = this.appendSuffixToSwiftIdentifier(
      mapping.swiftIdentifier,
      suffix,
    );

    return {
      ...mapping,
      newKey,
      swiftIdentifier,
    };
  }

  /**
   * Append suffix to Swift identifier while maintaining validity
   */
  private static appendSuffixToSwiftIdentifier(
    identifier: string,
    suffix: number,
  ): string {
    // Remove backticks if present (for keywords)
    const cleanIdentifier = identifier.replace(/`/g, "");
    const suffixedIdentifier = `${cleanIdentifier}_${suffix}`;

    // Re-add backticks if original was a keyword
    if (identifier.includes("`")) {
      return `\`${suffixedIdentifier}\``;
    }

    return suffixedIdentifier;
  }

  /**
   * Detect potential collisions before resolution
   */
  static detectPotentialCollisions(mappings: KeyMapping[]): CollisionInfo[] {
    const keyCountMap = new Map<string, number>();
    const collisions: CollisionInfo[] = [];

    // Count occurrences of each key
    for (const mapping of mappings) {
      const count = keyCountMap.get(mapping.newKey) || 0;
      keyCountMap.set(mapping.newKey, count + 1);
    }

    // Find collisions
    for (const [key, count] of keyCountMap) {
      if (count > 1) {
        collisions.push({
          originalKey: "", // Will be filled by first occurrence
          englishValue: key,
          newKey: key,
          conflictCount: count,
        });
      }
    }

    return collisions;
  }

  /**
   * Generate collision resolution report
   */
  static generateCollisionReport(collisions: CollisionInfo[]): string {
    if (collisions.length === 0) {
      return "No collisions detected.";
    }

    const lines: string[] = [];
    lines.push(`Collision Report: ${collisions.length} collision(s) detected`);
    lines.push("=".repeat(50));

    for (const collision of collisions) {
      lines.push(`English Value: "${collision.englishValue}"`);
      lines.push(`Conflicts: ${collision.conflictCount} keys`);
      lines.push(
        `Resolution: Original key preserved, others get numeric suffixes`,
      );
      lines.push("-".repeat(30));
    }

    return lines.join("\n");
  }

  /**
   * Validate that collision resolution was successful
   */
  static validateResolution(resolvedMappings: KeyMapping[]): {
    isValid: boolean;
    duplicateKeys: string[];
  } {
    const keySet = new Set<string>();
    const duplicateKeys: string[] = [];

    for (const mapping of resolvedMappings) {
      if (keySet.has(mapping.newKey)) {
        duplicateKeys.push(mapping.newKey);
      } else {
        keySet.add(mapping.newKey);
      }
    }

    return {
      isValid: duplicateKeys.length === 0,
      duplicateKeys,
    };
  }

  /**
   * Generate statistics about collision resolution
   */
  static generateResolutionStats(
    originalMappings: KeyMapping[],
    resolvedMappings: KeyMapping[],
  ): {
    totalKeys: number;
    collisionsResolved: number;
    keysWithSuffixes: number;
    longestResolvedKey: string;
  } {
    const totalKeys = originalMappings.length;
    const keysWithSuffixes = resolvedMappings.filter((m) =>
      m.newKey.includes("_"),
    ).length;
    const collisionsResolved = Math.max(
      0,
      totalKeys - (resolvedMappings.length - keysWithSuffixes),
    );
    const longestResolvedKey = resolvedMappings.reduce(
      (longest, m) => (m.newKey.length > longest.length ? m.newKey : longest),
      "",
    );

    return {
      totalKeys,
      collisionsResolved,
      keysWithSuffixes,
      longestResolvedKey,
    };
  }
}
