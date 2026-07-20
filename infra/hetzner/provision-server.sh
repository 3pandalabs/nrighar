#!/usr/bin/env bash
#
# Provisions the single Hetzner Cloud server for NRIGhar's Coolify host: a
# Firewall (22/80/443 only — Postgres is NEVER opened publicly, see
# infra/README.md) and the server itself.
#
# This script is meant to be READ before it's run, not executed blindly — it
# creates real, billable Hetzner resources. It is idempotent-ish (checks
# before creating where practical) so it's safe to re-run after fixing a
# variable, but it does not tear anything down for you.
#
# Prerequisites:
#   - hcloud CLI installed (https://github.com/hetznercloud/cli) and
#     authenticated: `hcloud context create nrighar` (prompts for an API
#     token — create one in the Hetzner Cloud console under the project's
#     Security -> API Tokens, "Read & Write").
#   - An SSH key already uploaded to the project, OR let this script upload
#     your local public key (see SSH_KEY_NAME / SSH_PUBLIC_KEY_PATH below).

set -euo pipefail

# ---- Fill these in before running ------------------------------------------
LOCATION="sin"                         # sin = Singapore, closest Hetzner region to India-based
                                        # landlords/tenants; fsn1/nbg1/hel1 (Germany/Finland) or
                                        # ash/hil (US) are the alternatives if latency there matters
                                        # more — verified via `hcloud location list` (single-word codes,
                                        # not "sin1" — that was a wrong assumption caught while running
                                        # this the first time).
SERVER_TYPE="cpx22"                    # 2 vCPU / 4GB RAM / 80GB disk (shared AMD) — Coolify's stated
                                        # minimum is 2GB, this gives headroom for Postgres + the API +
                                        # Coolify itself without over-provisioning; resize later if
                                        # needed. NOTE: the "cx" Intel line (e.g. cx22/cx23) is NOT
                                        # available in sin1/Singapore as of 2026-07 — only fsn1/nbg1/hel1
                                        # (Europe) — verified via `hcloud server-type list`. cpx22 is the
                                        # closest match actually available in sin1.
IMAGE="ubuntu-24.04"
SERVER_NAME="nrighar-coolify"
FIREWALL_NAME="nrighar-coolify-fw"
SSH_KEY_NAME="nrighar-coolify-key"     # name to register/reuse in the Hetzner project
SSH_PUBLIC_KEY_PATH="$HOME/.ssh/id_ed25519.pub"  # your local public key — CHANGE if it lives elsewhere
MY_IP_CIDR="69.248.0.248/32"           # your current public IP as of 2026-07-20 (curl -s -4 ifconfig.me) —
                                        # if your ISP gives you a dynamic IP, this may drift; re-check with
                                        # the same command if SSH access is ever refused later
# -----------------------------------------------------------------------------

if [[ "$MY_IP_CIDR" == "CHANGE_ME/32" ]]; then
  echo "Edit MY_IP_CIDR at the top of this script before running (curl -s ifconfig.me to find yours)." >&2
  exit 1
fi

if ! command -v hcloud >/dev/null; then
  echo "hcloud CLI not found. Install it: https://github.com/hetznercloud/cli#installation" >&2
  exit 1
fi

echo "== SSH key =="
if hcloud ssh-key describe "$SSH_KEY_NAME" >/dev/null 2>&1; then
  echo "SSH key '$SSH_KEY_NAME' already registered (skipping upload)."
else
  if [[ ! -f "$SSH_PUBLIC_KEY_PATH" ]]; then
    echo "No public key at $SSH_PUBLIC_KEY_PATH — generate one (ssh-keygen -t ed25519) or fix SSH_PUBLIC_KEY_PATH." >&2
    exit 1
  fi
  hcloud ssh-key create --name "$SSH_KEY_NAME" --public-key-from-file "$SSH_PUBLIC_KEY_PATH"
  echo "Registered SSH key '$SSH_KEY_NAME'."
fi

echo "== Firewall =="
if hcloud firewall describe "$FIREWALL_NAME" >/dev/null 2>&1; then
  echo "Firewall '$FIREWALL_NAME' already exists (skipping creation; verify its rules match below manually)."
else
  hcloud firewall create --name "$FIREWALL_NAME"
  hcloud firewall add-rule "$FIREWALL_NAME" --direction in --protocol tcp --port 22 \
    --source-ips "$MY_IP_CIDR" --description "ssh-admin-only"
  hcloud firewall add-rule "$FIREWALL_NAME" --direction in --protocol tcp --port 80 \
    --source-ips 0.0.0.0/0 --source-ips ::/0 --description "http-acme-challenge"
  hcloud firewall add-rule "$FIREWALL_NAME" --direction in --protocol tcp --port 443 \
    --source-ips 0.0.0.0/0 --source-ips ::/0 --description "https-traefik"
  echo "Rules added: 22 from $MY_IP_CIDR, 80/443 from anywhere. Port 5432 intentionally NOT opened."
fi

echo "== Creating server =="
if hcloud server describe "$SERVER_NAME" >/dev/null 2>&1; then
  echo "Server '$SERVER_NAME' already exists — skipping creation."
else
  hcloud server create \
    --name "$SERVER_NAME" \
    --type "$SERVER_TYPE" \
    --image "$IMAGE" \
    --location "$LOCATION" \
    --ssh-key "$SSH_KEY_NAME" \
    --firewall "$FIREWALL_NAME"
  echo "Server created."
fi

PUBLIC_IP=$(hcloud server ip "$SERVER_NAME")

echo ""
echo "=================================================================="
echo "Server:      $SERVER_NAME"
echo "Public IPv4: $PUBLIC_IP"
echo "Firewall:    $FIREWALL_NAME"
echo ""
echo "Note: unlike AWS, this public IPv4 is included free and stays with the"
echo "server for its lifetime — no separate 'Elastic IP' allocation step."
echo "(A Hetzner Floating IP exists if you later want an IP decoupled from a"
echo "specific server for failover — not needed for this single-box setup.)"
echo ""
echo "Next steps:"
echo "  1. ssh root@$PUBLIC_IP   (Hetzner Ubuntu images log in as root, not"
echo "     'ubuntu' like AWS — create a non-root admin user once in, if desired)"
echo "  2. Follow infra/coolify-setup.md to install Coolify"
echo "  3. Add an A record: api.nrighar.3pandalabs.com -> $PUBLIC_IP (DNS-only on Cloudflare)"
echo "=================================================================="
