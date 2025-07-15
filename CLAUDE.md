## Common Commands

### Build and Development

- `npm run build` - Compile TypeScript files to JavaScript
- `npm run translate` - Translate strings files using DeepL API and AI (automatically generates .xcstrings files)
- `npm run delete` - Delete an entry from all localization files (.strings, .json, .xcstrings)
- `npm run rename` - Rename a key from all localization files (.strings, .json, .xcstrings)
- `npm run compileToSwift` - Compile translation files to Swift code
- `npm run fileSync` - Synchronize .strings, .json, and .xcstrings files

### Localization Tool (l10n.sh)

- `./l10n.sh translate` - Translate strings using DeepL/OpenRouter APIs (automatically generates .xcstrings files)
- `./l10n.sh delete --key "key.name"` - Delete specific key from all files (.strings, .json, .xcstrings)
- `./l10n.sh rename --old-key "old.key" --new-key "new.key"` - Rename keys in all files (.strings, .json, .xcstrings)
- `./l10n.sh compileToSwift --ignore "AppShortcuts.strings, InfoPlist.strings"` - Generate Swift code
- `./l10n.sh sync --languages en,fr,it` - Sync localization files (.strings, .json, .xcstrings)

### Code Quality

- Uses prettier for code formatting via lint-staged
- Husky for git hooks with prettier formatting on commit

## Architecture

### Core Components

- **CasaZurigol10n.swift**: Main Swift package that provides Bundle access and language detection for supported languages (de, fr, en, it, es, pt-PT, tr)
- **Localization+Generated.swift**: Auto-generated Swift code containing L10n enum with localized strings and functions
- **TypeScript Scripts**: Translation management tools in `scripts/` directory

### Localization System

- **Resources Structure**: Language-specific folders (en.lproj, de.lproj, etc.) containing:
  - `Localizable.strings` - Main app strings
  - `InfoPlist.strings` - App metadata strings
  - `AppShortcuts.strings` - Siri shortcuts strings
  - Corresponding `.json` files for each `.strings` file
- **XCStrings Files**: Modern Apple format stored in Resources root:
  - `Localizable.xcstrings` - Unified localization file with all languages
  - `InfoPlist.xcstrings` - App metadata in unified format
  - `AppShortcuts.xcstrings` - Siri shortcuts in unified format

### Key Features

- **Multi-language Support**: 7 languages with automatic language detection
- **Swift Code Generation**: Automatic generation of type-safe Swift localization code
- **Format Specifier Support**: Handles parameterized strings with format specifiers
- **Localization Management**: Full CRUD operations for localization keys across all formats
- **AI Translation**: Integration with DeepL and OpenRouter for automated translations
- **XCStrings Support**: Automatic generation and synchronization of modern Apple .xcstrings format

### Build Process

1. TypeScript compilation (`npm run build`)
2. Localization processing via l10n.sh scripts
3. Swift code generation from .strings files
4. Bundle resource compilation

### Development Workflow

- Localization files are managed via JSON/strings file pairs with automatic .xcstrings generation
- Swift code is auto-generated from English .strings files
- Changes to localization require running `compileToSwift` to update Swift code
- Translation workflow supports both manual and AI-assisted translation
- **File Format Support**: All commands work with .strings, .json, and .xcstrings files simultaneously
- **Automatic XCStrings Generation**: Every translation run creates unified .xcstrings files for Xcode 15+ compatibility
