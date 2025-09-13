FROM python:3.9-slim

WORKDIR /app

# Install PostgreSQL client for pg_isready
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Make the entrypoint script executable
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Expose the port the app runs on
EXPOSE 5000

# Use the entrypoint script
ENTRYPOINT ["/app/docker-entrypoint.sh"]
