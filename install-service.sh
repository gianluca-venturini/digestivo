#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="digestivo-serve"

# Copy the serve script
sudo cp "$SCRIPT_DIR/serve.sh" /usr/local/bin/digestivo-serve.sh
sudo chmod +x /usr/local/bin/digestivo-serve.sh

# Create systemd unit
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<'EOF'
[Unit]
Description=Serve latest HN digest via Tailscale
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/digestivo-serve.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"

echo "Service '$SERVICE_NAME' installed and started."
echo "  Status:  sudo systemctl status $SERVICE_NAME"
echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
