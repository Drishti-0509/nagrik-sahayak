# Base image with Node.js 20 and Python 3 for ML inference
FROM node:20-slim

WORKDIR /app

# Install system dependencies including Python and build essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create and populate Python virtual environment for ML workloads
RUN python3 -m venv /app/ml_env && \
    /app/ml_env/bin/pip install --no-cache-dir --upgrade pip && \
    /app/ml_env/bin/pip install --no-cache-dir \
      torch --index-url https://download.pytorch.org/whl/cpu && \
    /app/ml_env/bin/pip install --no-cache-dir \
      sentence-transformers \
      faiss-cpu \
      scikit-learn \
      pandas \
      numpy \
      joblib

# Copy server package descriptors
COPY package*.json ./

# Install Node production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "src/server.js"]
