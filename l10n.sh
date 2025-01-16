#!/bin/bash

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Error: .env file not found!"
    exit 1
fi

source ".env"

# Show usage if no arguments provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <command> [options]"
    echo "Commands:"
    echo "  translate    Translate strings files"
    echo "  delete      Delete an entry from all strings files"
    echo ""
    echo "Example:"
    echo "  $0 translate              # Translate using settings from .env"
    echo "  $0 translate --target-langs fr it  # Override target languages"
    echo "  $0 delete --key \"key.to.delete\"   # Delete specific key from all files"
    exit 1
fi

SCRIPT_DIR="./scripts"

# Get the command (first argument)
COMMAND=$1
shift  # Remove the command from the arguments

case $COMMAND in
    "translate")
        python3 "$SCRIPT_DIR/translate.py" "$@"
        ;;
    "delete")
        python3 "$SCRIPT_DIR/delete_entries.py" "$@"
        ;;
    *)
        echo "Unknown command: $COMMAND"
        echo "Available commands: translate, delete"
        exit 1
        ;;
esac