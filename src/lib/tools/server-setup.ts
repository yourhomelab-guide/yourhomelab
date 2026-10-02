/**
 * Server setup script: turns the answers of the assistant plus "Mein Setup" into one bash script for a fresh
 * Debian or Ubuntu server (user, SSH key, Docker, firewall, updates, folders, reverse proxy, Dockhand, Pocket ID,
 * Tinyauth, SSH hardening). Pure functions, used in the browser.
 *
 * Secrets are NOT generated here. The service files carry markers (`@@SECRET_64@@`) that the script replaces with
 * `openssl rand` on the server, so the downloaded file never contains a password.
 */
import { LAN_RANGES, type Setup } from '../../config/site';
import { buildStack, fill, type StackService, type StackTexts } from './stack';

export interface ServerSetupInput {
  /** Login user (created if missing, member of sudo and docker) */
  user: string;
  /** One public key line (ssh-ed25519 …) */
  sshKey: string;
  sshPort: number;
  /** Turn off password and root login */
  hardenSsh: boolean;
  /** Only allow SSH from this network (CIDR), empty = from everywhere */
  sshFrom: string;
  fullUpgrade: boolean;
  firewall: boolean;
  autoUpdates: boolean;
  autoReboot: boolean;
  docker: boolean;
  /** Install the reverse proxy of "Mein Setup" */
  proxy: boolean;
  dockhand: boolean;
  pocketId: boolean;
  tinyauth: boolean;
  /** Put Tinyauth in front of Dockhand (and the Traefik dashboard) */
  protect: boolean;
  /** `user:bcrypt-hash` for Tinyauth */
  tinyauthUser: string;
}

export const SERVICE_ORDER = ['traefik', 'caddy', 'nginx-proxy-manager', 'tinyauth', 'pocket-id', 'dockhand'] as const;
export const proxyService: Record<string, string> = { traefik: 'traefik', caddy: 'caddy', npm: 'nginx-proxy-manager' };

export { LAN_RANGES };

/** Private (RFC 1918) or carrier-grade NAT address: the server sits in a home network, not directly on the internet */
export const isPrivateIp = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip);

/** Where admin-only ports listen. Docker-published ports bypass UFW, so they are bound to an address instead:
 * the LAN address at home, localhost on a public server (reachable through an SSH tunnel). The script checks at
 * run time that the LAN address really exists on the server and falls back to localhost otherwise. */
export const adminBind = (s: Setup) => (isPrivateIp(s.serverIp) ? s.serverIp : '127.0.0.1');
const ADMIN_MARK = '@@ADMIN_IP@@';

const KEY_RE = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) [A-Za-z0-9+/]+={0,3}( [^\r\n]*)?$/;
export const validKey = (k: string) => KEY_RE.test(k.trim());
export const validUser = (u: string) => /^[a-z_][a-z0-9_-]{0,31}$/.test(u) && u !== 'root';
export const validPort = (p: number) => Number.isInteger(p) && (p === 22 || (p >= 1024 && p <= 65535));
export const validCidr = (c: string) =>
  c === '' || /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d|[12]\d|3[0-2])$/.test(c) && c.split('/')[0].split('.').every((n) => Number(n) <= 255);

/** Problems that block the download, as text keys */
export function problems(i: ServerSetupInput, s: Setup): string[] {
  const out: string[] = [];
  if (!validUser(i.user)) out.push('errUser');
  if (!validKey(i.sshKey)) out.push('errKey');
  if (!validPort(i.sshPort)) out.push('errPort');
  if (!validCidr(i.sshFrom.trim())) out.push('errCidr');
  if ((i.dockhand || i.pocketId || i.tinyauth || i.proxy) && !i.docker) out.push('errDocker');
  if ((i.pocketId || i.tinyauth) && s.proxy === 'none') out.push('errHttps');
  if (i.tinyauth && !/^[^\s:,]+:\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(i.tinyauthUser)) out.push('errTinyauth');
  if (s.domain === 'example.com' && s.proxy !== 'none' && (i.proxy || i.dockhand || i.pocketId || i.tinyauth)) out.push('errDomain');
  return out;
}

/** Single-quoted shell word */
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** Marker the script replaces with `openssl rand` output of `n` characters */
const marker = (n?: number) => `@@SECRET_${n ?? 64}@@`;

/**
 * Login protection for Dockhand and the Traefik dashboard. The templates already let only the home network in
 * (lanOnly); with Tinyauth chosen, that rule is swapped for the Tinyauth middleware / forward_auth.
 * "No proxy": Dockhand's port is bound to the admin address (LAN IP or localhost).
 */
function protectFiles(files: { path: string; content: string }[], i: ServerSetupInput, s: Setup) {
  const useTinyauth = i.tinyauth && i.protect;
  for (const f of files) {
    if (useTinyauth && s.proxy === 'traefik' && /\/(dockhand|traefik)\/compose\.yaml$/.test(f.path)) {
      const name = f.path.includes('/traefik/') ? 'dashboard' : 'dockhand';
      f.content = f.content
        .split('\n')
        .filter((l) => !l.includes(`middlewares.${name}-lan.ipallowlist`) && !l.includes('# Home network only. With Tinyauth'))
        .join('\n')
        .replace(`routers.${name}.middlewares=${name}-lan`, `routers.${name}.middlewares=tinyauth`);
    }
    if (useTinyauth && s.proxy === 'caddy' && f.path.endsWith('/caddy/Caddyfile') && i.dockhand) {
      const block = new RegExp(`(dockhand\\.${s.domain.replace(/\./g, '\\.')} \\{\\n)  @outside not remote_ip [^\\n]*\\n  respond @outside 403\\n`);
      f.content = f.content.replace(block, `$1  forward_auth tinyauth:3000 {\n    uri /api/auth/caddy\n  }\n`);
    }
    if (s.proxy === 'none' && f.path.endsWith('/dockhand/compose.yaml')) {
      f.content = f.content.replace(/- "(\d+):3000"/, `- "${ADMIN_MARK}:$1:3000"`);
    }
    if (f.path.endsWith('/nginx-proxy-manager/compose.yaml')) f.content = f.content.replace('- "81:81"', `- "${ADMIN_MARK}:81:81"`);
    if (f.path.endsWith('/tinyauth/.env')) f.content = f.content.replace(/^TINYAUTH_USERS=.*$/m, () => `TINYAUTH_USERS='${i.tinyauthUser}'`);
  }
}

export interface ServerSetupMeta {
  toolUrl: string;
  articleUrl: string;
  date: string;
  texts: StackTexts;
  /** Names of the picked services, for the summary */
  names: Record<string, string>;
}

/** The complete bash script */
export function serverScript(i: ServerSetupInput, s: Setup, services: StackService[], meta: ServerSetupMeta): string {
  const L: string[] = [];
  const push = (...l: string[]) => L.push(...l);
  const user = i.user.trim();
  const key = i.sshKey.trim().replace(/\s+/g, ' ');
  const port = i.sshPort;
  const from = i.sshFrom.trim();
  const wantProxy = i.proxy && s.proxy !== 'none';

  // Service files from the stack builder (same templates as the service pages), secrets as markers
  const picked = services.filter((x) => (x.isProxy ? wantProxy && x.id === proxyService[s.proxy] : (x.id === 'dockhand' && i.dockhand) || (x.id === 'pocket-id' && i.pocketId) || (x.id === 'tinyauth' && i.tinyauth)));
  const order = (id: string) => SERVICE_ORDER.indexOf(id as (typeof SERVICE_ORDER)[number]);
  picked.sort((a, b) => order(a.id) - order(b.id));
  const files = picked.length ? buildStack(picked, s, meta.texts, { date: meta.date, toolUrl: meta.toolUrl, secret: marker }).filter((f) => !/\/(README\.md|setup\.sh)$/.test(f.path)) : [];
  protectFiles(files, i, s);
  const proxyNote = files.find((f) => f.path.endsWith('/PROXY.txt'));
  const stackFiles = files.filter((f) => f !== proxyNote).map((f) => ({ ...f, rel: f.path.split('/').slice(1).join('/') }));
  const needsAdmin = stackFiles.some((f) => f.content.includes(ADMIN_MARK));

  push(
    '#!/usr/bin/env bash',
    '# Homelab server setup, generated by yourhomelab:',
    `# ${meta.toolUrl}`,
    `# Every step is explained here: ${meta.articleUrl}`,
    `# Generated: ${meta.date}`,
    '#',
    '# Run it on the fresh server as root:   sudo bash setup-server.sh',
    '# Running it again is safe: existing users, keys and files are kept.',
    'set -euo pipefail',
    '',
    `USER_NAME=${q(user)}`,
    `SSH_KEY=${q(key)}`,
    `SSH_PORT=${port}`,
    `ROOT_DIR=${q(s.root)}`,
    ...(needsAdmin ? [`# Admin web UIs listen only here (Docker ports bypass the firewall)`, `ADMIN_IP=${q(adminBind(s))}`] : []),
    ...(s.dataMode === 'central' ? [`DATA_DIR=${q(s.dataRoot)}`] : []),
    ...(s.proxy !== 'none' ? [`NETWORK=${q(s.network)}`] : []),
    '',
    '# ---------------------------------------------------------------- checks',
    'if [ "$(id -u)" -ne 0 ]; then echo "Please run as root: sudo bash $0" >&2; exit 1; fi',
    '# shellcheck source=/dev/null',
    '. /etc/os-release',
    'case "${ID:-}" in',
    '  debian|ubuntu) ;;',
    '  *) echo "This script supports Debian and Ubuntu only (found: ${ID:-unknown})." >&2; exit 1 ;;',
    'esac',
    'export DEBIAN_FRONTEND=noninteractive',
    '# Everything is also written to a log file',
    'LOG=/var/log/homelab-setup.log',
    'exec > >(tee -a "$LOG") 2>&1',
    'step() { printf "\\n==> %s\\n" "$*"; }',
    ...(stackFiles.length ? ['# Stacks that did not start (e.g. Docker Hub rate limit); listed at the end, the script carries on', 'FAILED=()'] : []),
    '',
    '# Writes stdin to a file, but only if the file does not exist yet (re-runs keep your edits and secrets)',
    'write_new() {',
    '  if [ -e "$1" ]; then',
    '    echo "  kept  $1"',
    '    cat > /dev/null',
    '    return 1',
    '  fi',
    '  mkdir -p "$(dirname "$1")"',
    '  (umask 077 && cat > "$1")',
    '  chmod "$2" "$1"',
    '  echo "  new   $1"',
    '}',
    '',
    '# Replaces every @@SECRET_<n>@@ marker with a fresh random value of n characters',
    'fill_secrets() {',
    '  local n v',
    '  while n=$(grep -o -m1 "@@SECRET_[0-9]*@@" "$1" | head -n1 | tr -dc "0-9"); [ -n "$n" ]; do',
    '    v=$(openssl rand -hex $(( (n + 1) / 2 )) | cut -c1-"$n")',
    '    sed -i "0,/@@SECRET_${n}@@/s//${v}/" "$1"',
    '  done',
    '}',
    '',
    '# ---------------------------------------------------------------- packages',
    'step "Updating package lists and installing base tools"',
    'apt-get update',
    ...(i.fullUpgrade ? ['apt-get -y full-upgrade'] : []),
    `apt-get install -y ca-certificates curl openssl sudo${i.hardenSsh || port !== 22 ? ' openssh-server' : ''}${i.firewall ? ' ufw' : ''}${i.autoUpdates ? ' unattended-upgrades' : ''}`,
    '',
    '# ---------------------------------------------------------------- user',
    'step "User $USER_NAME"',
    'if id "$USER_NAME" > /dev/null 2>&1; then',
    '  echo "  exists"',
    'else',
    '  useradd --create-home --shell /bin/bash "$USER_NAME"',
    '  echo "  created. Choose a password for sudo:"',
    '  if [ -t 0 ]; then',
    '    until passwd "$USER_NAME"; do echo "  Please try again."; done',
    '  else',
    '    echo "  No terminal: set it later with  sudo passwd $USER_NAME" >&2',
    '  fi',
    'fi',
    'usermod -aG sudo "$USER_NAME"',
    'USER_GROUP=$(id -gn "$USER_NAME")',
    'USER_HOME=$(getent passwd "$USER_NAME" | cut -d: -f6)',
    '',
    'step "SSH key for $USER_NAME"',
    'install -d -m 700 -o "$USER_NAME" -g "$USER_GROUP" "$USER_HOME/.ssh"',
    'touch "$USER_HOME/.ssh/authorized_keys"',
    'if grep -qxF "$SSH_KEY" "$USER_HOME/.ssh/authorized_keys"; then',
    '  echo "  key already present"',
    'else',
    '  printf "%s\\n" "$SSH_KEY" >> "$USER_HOME/.ssh/authorized_keys"',
    '  echo "  key added"',
    'fi',
    'chown "$USER_NAME:$USER_GROUP" "$USER_HOME/.ssh/authorized_keys"',
    'chmod 600 "$USER_HOME/.ssh/authorized_keys"',
  );

  if (i.docker) {
    push(
      '',
      '# ---------------------------------------------------------------- docker',
      '# Official repository, as in https://docs.docker.com/engine/install/',
      'step "Installing Docker"',
      '# Remove distribution packages that conflict with the official ones (none on a fresh server)',
      'mapfile -t conflicts < <(dpkg --get-selections docker.io docker-compose docker-doc docker-buildx podman-docker containerd runc 2> /dev/null | cut -f1)',
      'if [ "${#conflicts[@]}" -gt 0 ]; then apt-get remove -y "${conflicts[@]}"; fi',
      'install -m 0755 -d /etc/apt/keyrings',
      'curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc',
      'chmod a+r /etc/apt/keyrings/docker.asc',
      'cat > /etc/apt/sources.list.d/docker.sources <<EOF',
      'Types: deb',
      'URIs: https://download.docker.com/linux/${ID}',
      'Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}',
      'Components: stable',
      'Architectures: $(dpkg --print-architecture)',
      'Signed-By: /etc/apt/keyrings/docker.asc',
      'EOF',
      'apt-get update',
      'apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin',
      'systemctl enable --now docker',
      '# Lets the user run docker without sudo. Note: the docker group is as powerful as root.',
      'getent group docker > /dev/null || groupadd docker',
      'usermod -aG docker "$USER_NAME"',
      'docker --version',
      'docker compose version',
    );
  }

  if (i.autoUpdates) {
    push(
      '',
      '# ---------------------------------------------------------------- automatic updates',
      'step "Automatic security updates"',
      'cat > /etc/apt/apt.conf.d/20auto-upgrades <<EOF',
      'APT::Periodic::Update-Package-Lists "1";',
      'APT::Periodic::Unattended-Upgrade "1";',
      'EOF',
    );
    if (i.autoReboot)
      push(
        'cat > /etc/apt/apt.conf.d/51unattended-upgrades-local <<EOF',
        '// Reboot at 04:00 when an update (e.g. a new kernel) requires it',
        'Unattended-Upgrade::Automatic-Reboot "true";',
        'Unattended-Upgrade::Automatic-Reboot-Time "04:00";',
        'EOF',
      );
    push('systemctl enable --now unattended-upgrades');
  }

  if (i.firewall) {
    const rule = (p: string) => (from ? `from ${from} to any port ${p} proto tcp` : `${p}/tcp`);
    const sshRule = `ufw allow ${rule('"$SSH_PORT"')} comment 'SSH'`;
    // While the port changes, 22 stays open; the SSH step closes it once the new port works
    const keep22 = port !== 22 ? [`ufw allow ${rule('22')}`] : [];
    push(
      '',
      '# ---------------------------------------------------------------- firewall',
      '# Note: ports published by Docker containers bypass UFW. The templates only publish what is needed.',
      'step "Firewall (UFW)"',
      'ufw default deny incoming',
      'ufw default allow outgoing',
      sshRule,
      ...keep22,
      ...(wantProxy ? ["ufw allow 80/tcp comment 'HTTP'", "ufw allow 443/tcp comment 'HTTPS'", "ufw allow 443/udp comment 'HTTP/3'"] : []),
      'ufw --force enable',
      'ufw status verbose',
    );
  }

  push(
    '',
    '# ---------------------------------------------------------------- folders',
    'step "Folders"',
    `mkdir -p "$ROOT_DIR"${s.dataMode === 'central' ? ' "$DATA_DIR"' : ''}`,
    `chown "$USER_NAME:$USER_GROUP" "$ROOT_DIR"${s.dataMode === 'central' ? ' "$DATA_DIR"' : ''}`,
    `chmod 750 "$ROOT_DIR"${s.dataMode === 'central' ? ' "$DATA_DIR"' : ''}`,
    'ls -ld "$ROOT_DIR"',
  );

  if (stackFiles.length) {
    const needsNet = picked.some((x) => x.net || x.isProxy) && s.proxy !== 'none';
    push('', '# ---------------------------------------------------------------- stacks');
    if (needsAdmin && adminBind(s) !== '127.0.0.1')
      push(
        '# A wrong address would stop the container from starting: fall back to localhost (SSH tunnel)',
        'if ! hostname -I | tr " " "\\n" | grep -qxF "$ADMIN_IP"; then',
        '  echo "  $ADMIN_IP is not an address of this server, admin web UIs listen on 127.0.0.1 instead." >&2',
        '  ADMIN_IP=127.0.0.1',
        'fi',
      );
    if (needsNet) push('step "Docker network $NETWORK"', 'docker network inspect "$NETWORK" > /dev/null 2>&1 || docker network create "$NETWORK"');
    for (const x of picked) {
      push('', `step ${q(`Stack ${meta.names[x.id] ?? x.id}`)}`);
      for (const f of stackFiles.filter((f) => f.rel.startsWith(`${x.id}/`))) {
        const path = `${s.root}/${f.rel}`;
        const isEnv = f.rel.endsWith('/.env');
        const content = f.content.replace(/\n*$/, '\n');
        if (content.includes('\nYHL_EOF\n')) throw new Error(`heredoc delimiter inside ${f.rel}`);
        push(`if write_new ${q(path)} ${isEnv ? '600' : '644'} <<'YHL_EOF'`, ...content.trimEnd().split('\n'), 'YHL_EOF');
        const admin = content.includes(ADMIN_MARK) ? ` sed -i "s/${ADMIN_MARK}/$ADMIN_IP/g" ${q(path)};` : '';
        push(`then${content.includes('@@SECRET_') ? ` fill_secrets ${q(path)};` : ''}${admin} chown "$USER_NAME:$USER_GROUP" ${q(path)}; fi`);
      }
      // Only the stack folder itself, never the data below it (containers own those files)
      push(`chown "$USER_NAME:$USER_GROUP" ${q(`${s.root}/${x.id}`)}`);
      const dir = q(`${s.root}/${x.id}`);
      push(`(cd ${dir} && docker compose up -d) || { FAILED+=(${dir}); echo "  WARNING: stack did not start, see the error above" >&2; }`);
    }
  }

  if (i.hardenSsh || port !== 22) {
    push(
      '',
      '# ---------------------------------------------------------------- ssh',
      '# Last step on purpose: your current session stays open, test the new login before you close it.',
      'step "Hardening SSH"',
      'if [ ! -s "$USER_HOME/.ssh/authorized_keys" ]; then echo "No SSH key for $USER_NAME, refusing to change SSH." >&2; exit 1; fi',
      '# Our settings go into a drop-in file; the main config must include that folder (default on current Debian/Ubuntu)',
      'if ! grep -qiE "^\\s*Include\\s+/etc/ssh/sshd_config\\.d/" /etc/ssh/sshd_config; then',
      '  echo "/etc/ssh/sshd_config does not include sshd_config.d, refusing to change SSH." >&2',
      '  exit 1',
      'fi',
      'CONF=/etc/ssh/sshd_config.d/10-homelab.conf',
      'cat > "$CONF" <<EOF',
      '# Written by the yourhomelab setup script. Files in this folder are read in alphabetical',
      '# order and the first value wins, so 10- comes before e.g. 50-cloud-init.conf.',
      'Port $SSH_PORT',
      ...(i.hardenSsh
        ? ['PasswordAuthentication no', 'KbdInteractiveAuthentication no', 'PubkeyAuthentication yes', 'PermitRootLogin no', 'MaxAuthTries 3', 'X11Forwarding no']
        : []),
      'EOF',
      'chmod 644 "$CONF"',
      'mkdir -p /run/sshd',
      'if ! sshd -t; then',
      '  echo "The new SSH configuration is invalid, removing it again." >&2',
      '  rm -f "$CONF"',
      '  exit 1',
      'fi',
      '# Newer Ubuntu starts SSH through ssh.socket, which ignores the Port setting. Switch to the classic service.',
      'if systemctl is-enabled --quiet ssh.socket 2> /dev/null; then',
      '  systemctl disable --now ssh.socket',
      '  systemctl enable ssh.service',
      'fi',
      'systemctl restart ssh.service',
      'sleep 2',
      'if ! ss -tln | grep -q ":$SSH_PORT\\b"; then',
      '  echo "SSH does not listen on port $SSH_PORT, rolling back." >&2',
      '  rm -f "$CONF"',
      '  systemctl restart ssh.service',
      '  exit 1',
      'fi',
    );
    if (port !== 22 && i.firewall)
      push('# The new port works: close the old one in the firewall', `ufw delete allow ${from ? `from ${from} to any port 22 proto tcp` : '22/tcp'}`);
    if (i.hardenSsh) push('sshd -T | grep -Ei "^(port|passwordauthentication|permitrootlogin|pubkeyauthentication) "');
  }

  // Summary
  const ip = s.serverIp;
  const portArg = port === 22 ? '' : ` -p ${port}`;
  push(
    '',
    '# ---------------------------------------------------------------- done',
    'echo',
    'echo "================================================================"',
    'echo " Done. Log file: $LOG"',
    'echo "================================================================"',
    'echo',
    'echo "1. Test the login in a NEW terminal before you close this one:"',
    `echo ${q(`     ssh${portArg} ${user}@${ip}`)}`,
    ...(port !== 22 ? [`echo ${q(`   Cloud firewall at your provider? Open TCP port ${port} there as well.`)}`] : []),
    ...(i.docker ? ['echo "2. Log out and in again once, so the docker group applies to $USER_NAME."'] : []),
  );
  // Admin ports: LAN address or, on a public server, localhost through an SSH tunnel (decided at run time)
  const adminUrl = (p: number, localPort: number, indent: string) =>
    `if [ "$ADMIN_IP" = 127.0.0.1 ]; then echo ${q(`${indent}through an SSH tunnel: ssh -L ${localPort}:127.0.0.1:${p}${portArg} ${user}@${ip}   then open http://localhost:${localPort}`)}; else echo ${q(`${indent}http://`)}"$ADMIN_IP"${q(`:${p}`)}; fi`;
  for (const x of picked) {
    const m = x.id === 'dockhand' && s.proxy === 'none' ? /:(\d+)\/?$/.exec(fill(x.url, s)) : null;
    if (m) push(`echo ${q(`   ${meta.names[x.id] ?? x.id}:`)}`, adminUrl(Number(m[1]), Number(m[1]), '     '));
    else push(`echo ${q(`   ${meta.names[x.id] ?? x.id}: ${fill(x.url, s)}`)}`);
  }
  if ((s.proxy === 'npm' && i.proxy) || i.pocketId || i.dockhand) push('echo', 'echo "3. Right away, before anyone else can:"');
  if (s.proxy === 'npm' && i.proxy)
    push(
      `echo ${q(`   Nginx Proxy Manager: create your admin account in the web UI on port 81:`)}`,
      adminUrl(81, 8181, '     '),
    );
  if (i.pocketId) push(`echo ${q(`   Pocket ID: create your admin account and passkey: https://id.${s.domain}/setup`)}`);
  if (i.dockhand) push(`echo ${q('   Dockhand: Settings > Authentication: add a user, then switch authentication on (it ships without login).')}`);
  if (i.dockhand && s.proxy === 'npm')
    push(`echo ${q('   Dockhand: in Nginx Proxy Manager, add an Access List to its proxy host (home network only) or put Tinyauth in front.')}`);
  else if (i.dockhand && s.proxy !== 'none' && !(i.tinyauth && i.protect))
    push(
      `echo ${q(
        isPrivateIp(ip)
          ? '   Dockhand only answers requests from your home network.'
          : '   Dockhand only answers requests from home network addresses, which a public server never sees: protect it with Tinyauth instead.',
      )}`,
    );
  if (proxyNote) push('echo', `echo ${q('Proxy entries you still have to add:')}`, ...proxyNote.content.trimEnd().split('\n').map((l) => `echo ${q(l)}`));
  if (wantProxy) push(`echo ${q(`DNS: the names must point to this server (e.g. a wildcard *.${s.domain}), otherwise there are no certificates.`)}`);
  if (stackFiles.length)
    push(
      'if [ "${#FAILED[@]}" -gt 0 ]; then',
      '  echo',
      '  echo "These stacks did not start. Fix the cause and run  docker compose up -d  in their folder:"',
      '  printf "     %s\\n" "${FAILED[@]}"',
      'fi',
    );
  push('if [ -f /var/run/reboot-required ]; then echo "A reboot is required to finish the updates: sudo reboot"; fi', '');
  return L.join('\n');
}
