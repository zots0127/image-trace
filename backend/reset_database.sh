#!/bin/bash

# Database Reset Script
# This script resets the database and recreates the schema
# Usage: ./reset_database.sh

echo "🔄 Resetting database..."

# Set database file path
DB_FILE="image_trace.db"

# Stop any running processes that might be using the database
echo "⚠️  Stopping any processes that might be using the database..."

# Backup existing database if it exists
if [ -f "$DB_FILE" ]; then
    echo "💾 Backing up existing database to ${DB_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$DB_FILE" "${DB_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Remove the old database
echo "🗑️  Removing old database file..."
rm -f "$DB_FILE"

# Create new database with schema
echo "📝 Creating new database with schema..."
sqlite3 "$DB_FILE" < init_database.sql

# Verify database was created
if [ -f "$DB_FILE" ]; then
    echo "✅ Database reset successfully!"
    echo "📊 Database schema:"
    sqlite3 "$DB_FILE" ".schema"
else
    echo "❌ Error: Failed to create database!"
    exit 1
fi

echo "🎉 Database reset complete!"