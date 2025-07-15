import * as fs from "fs";
import * as path from "path";

/**
 * Backup and restore functionality for migration safety
 */
export class BackupManager {
  private static readonly BACKUP_DIR = "migration-backups";
  private static readonly RESOURCES_DIR = "Sources/CasaZurigol10n/Resources";

  /**
   * Create a timestamped backup of the Resources directory
   */
  static async createBackup(projectRoot: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(projectRoot, this.BACKUP_DIR, backupName);
    const sourcePath = path.join(projectRoot, this.RESOURCES_DIR);

    try {
      // Create backup directory if it doesn't exist
      await fs.promises.mkdir(path.dirname(backupPath), { recursive: true });

      // Copy entire Resources directory
      await this.copyDirectory(sourcePath, backupPath);

      // Create metadata file
      await this.createBackupMetadata(backupPath, timestamp);

      console.log(`✅ Backup created: ${backupPath}`);
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`);
    }
  }

  /**
   * Restore from a backup
   */
  static async restoreBackup(
    projectRoot: string,
    backupPath: string,
  ): Promise<void> {
    const targetPath = path.join(projectRoot, this.RESOURCES_DIR);

    try {
      // Verify backup exists
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup not found: ${backupPath}`);
      }

      // Verify backup metadata
      await this.verifyBackupMetadata(backupPath);

      // Remove current Resources directory
      if (fs.existsSync(targetPath)) {
        await fs.promises.rm(targetPath, { recursive: true });
      }

      // Restore from backup
      await this.copyDirectory(backupPath, targetPath);

      console.log(`✅ Backup restored from: ${backupPath}`);
    } catch (error) {
      throw new Error(`Failed to restore backup: ${error}`);
    }
  }

  /**
   * List available backups
   */
  static async listBackups(projectRoot: string): Promise<
    Array<{
      path: string;
      timestamp: string;
      size: number;
    }>
  > {
    const backupDir = path.join(projectRoot, this.BACKUP_DIR);

    if (!fs.existsSync(backupDir)) {
      return [];
    }

    const backups: Array<{
      path: string;
      timestamp: string;
      size: number;
    }> = [];

    const entries = await fs.promises.readdir(backupDir, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith("backup-")) {
        const backupPath = path.join(backupDir, entry.name);
        const metadataPath = path.join(backupPath, "backup-metadata.json");

        if (fs.existsSync(metadataPath)) {
          const metadata = JSON.parse(
            await fs.promises.readFile(metadataPath, "utf8"),
          );
          const size = await this.getDirectorySize(backupPath);

          backups.push({
            path: backupPath,
            timestamp: metadata.timestamp,
            size,
          });
        }
      }
    }

    return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Clean up old backups (keep only the 5 most recent)
   */
  static async cleanupOldBackups(
    projectRoot: string,
    keepCount: number = 5,
  ): Promise<void> {
    const backups = await this.listBackups(projectRoot);

    if (backups.length <= keepCount) {
      return;
    }

    const backupsToRemove = backups.slice(keepCount);
    for (const backup of backupsToRemove) {
      await fs.promises.rm(backup.path, { recursive: true });
      console.log(`🗑️  Removed old backup: ${backup.path}`);
    }
  }

  /**
   * Copy directory recursively
   */
  private static async copyDirectory(
    source: string,
    destination: string,
  ): Promise<void> {
    await fs.promises.mkdir(destination, { recursive: true });

    const entries = await fs.promises.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.promises.copyFile(sourcePath, destPath);
      }
    }
  }

  /**
   * Create backup metadata file
   */
  private static async createBackupMetadata(
    backupPath: string,
    timestamp: string,
  ): Promise<void> {
    const metadata = {
      timestamp,
      version: "1.0.0",
      description: "Localization migration backup",
      createdBy: "CasaZurigol10n Migration Tool",
    };

    const metadataPath = path.join(backupPath, "backup-metadata.json");
    await fs.promises.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
    );
  }

  /**
   * Verify backup metadata
   */
  private static async verifyBackupMetadata(backupPath: string): Promise<void> {
    const metadataPath = path.join(backupPath, "backup-metadata.json");

    if (!fs.existsSync(metadataPath)) {
      throw new Error("Backup metadata not found");
    }

    const metadata = JSON.parse(
      await fs.promises.readFile(metadataPath, "utf8"),
    );

    if (!metadata.timestamp || !metadata.version) {
      throw new Error("Invalid backup metadata");
    }
  }

  /**
   * Get directory size in bytes
   */
  private static async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += await this.getDirectorySize(fullPath);
      } else {
        const stats = await fs.promises.stat(fullPath);
        totalSize += stats.size;
      }
    }

    return totalSize;
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    const sizes = ["B", "KB", "MB", "GB"];
    if (bytes === 0) return "0 B";

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  }

  /**
   * Verify backup integrity
   */
  static async verifyBackupIntegrity(backupPath: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Check if backup directory exists
      if (!fs.existsSync(backupPath)) {
        errors.push("Backup directory does not exist");
        return { isValid: false, errors };
      }

      // Check metadata
      await this.verifyBackupMetadata(backupPath);

      // Check for required directories
      const requiredDirs = [
        "en.lproj",
        "de.lproj",
        "fr.lproj",
        "it.lproj",
        "es.lproj",
        "pt-PT.lproj",
        "tr.lproj",
      ];
      for (const dir of requiredDirs) {
        const dirPath = path.join(backupPath, dir);
        if (!fs.existsSync(dirPath)) {
          errors.push(`Missing language directory: ${dir}`);
        }
      }

      // Check for required files
      const requiredFiles = [
        "Localizable.xcstrings",
        "InfoPlist.xcstrings",
        "AppShortcuts.xcstrings",
      ];
      for (const file of requiredFiles) {
        const filePath = path.join(backupPath, file);
        if (!fs.existsSync(filePath)) {
          errors.push(`Missing file: ${file}`);
        }
      }
    } catch (error) {
      errors.push(`Integrity check failed: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
