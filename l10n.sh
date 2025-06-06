#!/bin/bash

# Function to display help message
show_help() {
    cat << EOF
Usage: $(basename $0) <command> [options]

A tool for managing localization files.

Commands:
    translate       Translate strings files using DeepL API
    delete          Delete an entry from all the files
    rename          Rename a key from all the files
    compileToSwift  Compiles the curren translation files to a Swift file
    sync            Synchronize .strings and .json files
    help            Show this help message

Global Options:
    -h, --help  Show this help message

Command-specific Options:
    translate:
        --deepl-key <key>              DeepL API authentication key (or use DEEPL_AUTH_KEY env variable)
        --openRouter-key <key>         OpenRouter API authentication key (or use OPENROUTER_AUTH_KEY env variable)
        --source-lang <lang>           Source language code (default: en)
        --target-langs <langs>         Target language codes (comma-separated)
        --input-dir <path>             Input directory (default: ./Sources/CasaZurigol10n/Resources)
        --output-dir <path>            Output directory (default: ./Sources/CasaZurigol10n/Resources)
        --ai-model <model>             AI model to use for refinement (default: google/gemini-2.5-flash-preview)
        --context <context>            Additional context for AI refinement
        --ignore-all-translations      Ignore all existing translations in target-langs
        --key <key>                    Translate a specific key only

    delete:
        --key <key>               The key to delete from all files

    rename:
        --old-key <key>           The key to be renamed
        --new-key <key>           The new name for the key

    compileToSwift:
        --input-dir <path>        Input directory containing .strings files (default: ./Sources/CasaZurigol10n/Resources/en.lproj)
        --ignore <files>          Comma-separated list of files to ignore
        --output <path>           Output Swift file path (default: ./Sources/CasaZurigol10n/Generated/Localization+Generated.swift)

    sync:
        --input-dir <path>        Input directory (default: ./Sources/CasaZurigol10n/Resources)
        --languages <langs>       Language codes to sync (comma-separated)
        --file <name>             Specific file to sync (without extension)

Examples:
    $(basename $0) translate                                                            # Translate using settings from .env
    $(basename $0) translate --source-lang en --target-langs fr,it                      # Override source and target languages
    $(basename $0) delete --key "key.to.delete"                                         # Delete specific key from all files
    $(basename $0) rename --old-key "old.key" --new-key "new.key"                       # Rename specific key in all files
    $(basename $0) compileToSwift --ignore "AppShortcuts.strings,Foo.strings"           # Compile translation files to a Swift file
    $(basename $0) sync --languages en,fr,it                                            # Sync all files for specified languages
    $(basename $0) sync --file "Localizable" --languages en,fr                          # Sync specific file for specified languages

Environment Variables:
    DEEPL_AUTH_KEY         DeepL API authentication key
    OPENROUTER_AUTH_KEY    OpenRouter API authentication key
    SOURCE_LANG            Source language code (default: en)
    TARGET_LANG            Target language codes (comma-separated)

For more detailed information about a specific command, use:
    $(basename $0) <command> --help
EOF
}

# Check if .env file exists and source it
if [ -f ".env" ]; then
    source ".env"
else
    echo "Warning: .env file not found. Continuing without it."
fi

# Show help if no arguments or help flag is provided
if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ] || [ "$1" = "help" ]; then
    show_help
    exit 0
fi

SCRIPT_DIR="./scripts"

# Get the command (first argument)
COMMAND=$1
shift  # Remove the command from the arguments

case $COMMAND in
    "translate")
        npm run translate -- "$@"
        ;;
    "delete")
        npm run delete -- "$@"
        ;;
    "rename")
        npm run rename -- "$@"
        ;;
    "compileToSwift")
        npm run compileToSwift -- "$@"
        ;;
    "sync")
        npm run fileSync -- "$@"
        ;;
    *)
        echo "Error: Unknown command: $COMMAND"
        echo "Run '$(basename $0) --help' for usage information"
        exit 1
        ;;
esac