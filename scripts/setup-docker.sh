#!/usr/bin/env bash
# Setup script for deploying TRIBE v2 to Replicate via Cog.
# Installs Docker, Cog CLI, and NVIDIA Container Toolkit (for GPU).
# Run with: sudo bash scripts/setup-docker.sh
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[+]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# -------------------------------------------------------------------
# 0. Root check
# -------------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  error "This script must be run as root. Use: sudo bash $0"
fi

REAL_USER="${SUDO_USER:-$USER}"

# -------------------------------------------------------------------
# 1. Docker Engine
# -------------------------------------------------------------------
if command -v docker &>/dev/null; then
  info "Docker already installed: $(docker --version)"
else
  info "Installing Docker Engine..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources-list.d/docker.list 2>/dev/null || \
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin

  info "Docker installed: $(docker --version)"
fi

# -------------------------------------------------------------------
# 2. Start Docker daemon
# -------------------------------------------------------------------
if ! docker info &>/dev/null; then
  info "Starting Docker daemon..."
  systemctl enable docker
  systemctl start docker
  info "Docker daemon running."
else
  info "Docker daemon already running."
fi

# -------------------------------------------------------------------
# 3. Add user to docker group (so they don't need sudo for docker)
# -------------------------------------------------------------------
if ! id -nG "$REAL_USER" | grep -qw docker; then
  info "Adding $REAL_USER to docker group..."
  usermod -aG docker "$REAL_USER"
  warn "Log out and back in (or run 'newgrp docker') for group change to take effect."
else
  info "$REAL_USER already in docker group."
fi

# -------------------------------------------------------------------
# 4. NVIDIA Container Toolkit (for GPU support)
# -------------------------------------------------------------------
if command -v nvidia-smi &>/dev/null; then
  info "NVIDIA GPU detected: $(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)"

  if dpkg -l nvidia-container-toolkit &>/dev/null; then
    info "NVIDIA Container Toolkit already installed."
  else
    info "Installing NVIDIA Container Toolkit..."
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
      | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

    curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
      | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
      > /etc/apt/sources.list.d/nvidia-container-toolkit.list

    apt-get update -qq
    apt-get install -y -qq nvidia-container-toolkit
    nvidia-ctk runtime configure --runtime=docker
    systemctl restart docker
    info "NVIDIA Container Toolkit installed and configured."
  fi
else
  warn "No NVIDIA GPU detected. Skipping NVIDIA Container Toolkit."
  warn "GPU is recommended for inference — CPU will be very slow."
fi

# -------------------------------------------------------------------
# 5. Cog CLI
# -------------------------------------------------------------------
if command -v cog &>/dev/null; then
  info "Cog already installed: $(cog --version)"
else
  info "Installing Cog CLI..."
  curl -o /usr/local/bin/cog -L \
    "https://github.com/replicate/cog/releases/latest/download/cog_$(uname -s)_$(uname -m)"
  chmod +x /usr/local/bin/cog
  info "Cog installed: $(cog --version)"
fi

# -------------------------------------------------------------------
# Done
# -------------------------------------------------------------------
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Next steps:"
echo ""
echo "    1. Log in to Replicate:"
echo "       cog login"
echo ""
echo "    2. Push the model:"
echo "       cd $(pwd)"
echo "       cog push r8.im/prostacklabs/tribe-v2"
echo ""
echo "    3. (Optional) Test locally first:"
echo "       cog predict -i video_url=\"https://example.com/video.mp4\""
echo ""
