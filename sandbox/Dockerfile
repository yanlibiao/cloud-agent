FROM ubuntu:22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Install essential tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    git \
    vim \
    nano \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    unzip \
    ripgrep \
    jq \
    tree \
    && rm -rf /var/lib/apt/lists/*

# Create sandbox user
RUN useradd -m -u 1000 -s /bin/bash sandbox \
    && mkdir -p /workspace /tmp \
    && chown sandbox:sandbox /workspace /tmp

# Pre-install popular Python packages
RUN pip3 install --no-cache-dir \
    flask \
    fastapi \
    uvicorn \
    requests \
    httpx \
    numpy \
    pandas \
    pytest \
    jinja2 \
    && rm -rf ~/.cache/pip

# Set working directory
WORKDIR /workspace

# Switch to non-root user
USER sandbox

CMD ["tail", "-f", "/dev/null"]
