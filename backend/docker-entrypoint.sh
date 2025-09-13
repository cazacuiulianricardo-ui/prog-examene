#!/bin/bash
set -e

# Wait for the database to be ready
echo "Waiting for PostgreSQL to be ready..."
while ! pg_isready -h db -U postgres -q; do
  sleep 1
done
echo "PostgreSQL is ready!"

# Initialize the database
echo "Initializing database..."
python init_db.py
echo "Database initialized!"

# Populate the database with sample data
echo "Populating database with sample data..."
python populate_db.py
echo "Database populated!"

# Start the Flask application
echo "Starting Flask application..."
exec python app.py
