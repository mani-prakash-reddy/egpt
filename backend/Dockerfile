FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including network tools
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    libffi-dev \
    libxml2-dev \
    libxslt-dev \
    libpq-dev \
    build-essential \
    curl \
    dnsutils \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --upgrade pip setuptools wheel
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make startup script executable
RUN chmod +x startup.sh

# Create data directory
RUN mkdir -p ./data

# Expose port
EXPOSE 8000

# Run the application with startup script
CMD ["./startup.sh"]