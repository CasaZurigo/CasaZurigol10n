#!/bin/bash

# Function to display help message
show_help() {
    cat << EOF
Usage: $(basename $0) <command> [options]

A tool for managing localization files.

Commands:
    translate   Translate strings files using DeepL API
    delete      Delete an entry from all the files
    rename      Rename a key from all the files
    help        Show this help message

Global Options:
    -h, --help  Show this help message

Command-specific Options:
    translate:
        --auth-key <key>          DeepL API authentication key (or use DEEPL_AUTH_KEY env variable)
        --source-lang <lang>      Source language code (default: en)
        --target-langs <langs>    Target language codes (comma-separated)
        --input-dir <dir>         Input directory (default: ./Sources/CasaZurigol10n/Resources)
        --output-dir <dir>        Output directory (default: ./Sources/CasaZurigol10n/Resources)

    delete:
        --key <key>              The key to delete from all files

    rename:
        --old-key <key>          The key to be renamed
        --new-key <key>          The new name for the key

Examples:
    $(basename $0) translate                                                    # Translate using settings from .env
    $(basename $0) translate --source-lang en --target-langs fr,it             # Override source and target languages
    $(basename $0) delete --key "key.to.delete"                               # Delete specific key from all files
    $(basename $0) rename --old-key "old.key" --new-key "new.key"            # Rename specific key in all files

Environment Variables:
    DEEPL_AUTH_KEY    DeepL API authentication key
    SOURCE_LANG       Source language code (default: en)
    TARGET_LANG       Target language codes (comma-separated)
    INPUT_DIR         Input directory path
    OUTPUT_DIR        Output directory path

For more detailed information about a specific command, use:
    $(basename $0) <command> --help
EOF
}

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Error: .env file not found!"
    exit 1
fi
source ".env"

# Check if Node.js and npm are installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed!"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed!"
    exit 1
fi

# Show help if no arguments or help flag is provided
if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ] || [ "$1" = "help" ]; then
    show_help
    exit 0
fi

SCRIPT_DIR="./scripts"

# Ensure TypeScript files are compiled
npm run build &> /dev/null || {
    echo "Error: Failed to compile TypeScript files"
    exit 1
}

# Get the command (first argument)
COMMAND=$1
shift  # Remove the command from the arguments

case $COMMAND in
    "translate")
        npx ts-node "$SCRIPT_DIR/translate.ts" "$@"
        ;;
    "delete")
        npx ts-node "$SCRIPT_DIR/deleteEntries.ts" "$@"
        ;;
    "rename")
        npx ts-node "$SCRIPT_DIR/renameEntries.ts" "$@"
        ;;
    *)
        echo "Error: Unknown command: $COMMAND"
        echo "Run '$(basename $0) --help' for usage information"
        exit 1
        ;;
esac