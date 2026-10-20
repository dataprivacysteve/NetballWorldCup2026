#!/usr/bin/env bash
# Read-only inventory for drafting a Debian 13 / ISPConfig application guide.
# Review output before sharing. Never paste passwords, environment files, or keys.
set -u

section() { printf '\n### %s\n' "$1"; }
available() { command -v "$1" >/dev/null 2>&1; }

section "Inventory date and host"
date -u '+UTC=%Y-%m-%dT%H:%M:%SZ'
hostname

section "Operating system and capacity"
grep -E '^(PRETTY_NAME|VERSION_ID)=' /etc/os-release 2>/dev/null || true
uname -m
if available nproc; then nproc; fi
if available free; then free -h; fi
if available df; then df -h / /var 2>/dev/null; fi
if available timedatectl; then timedatectl show -p Timezone -p NTPSynchronized 2>/dev/null; fi

section "Installed runtime and tools"
for tool in node corepack pnpm git psql apache2ctl nginx supervisord supervisorctl php; do
  if available "$tool"; then
    printf '%-15s %s\n' "$tool" "$(command -v "$tool")"
  else
    printf '%-15s %s\n' "$tool" 'not found'
  fi
done
if available node; then node --version; fi
if available corepack; then corepack --version; fi
if available git; then git --version; fi
if available psql; then psql --version; fi
if available apache2; then apache2 -v 2>&1 | head -n 1; fi
if available supervisord; then supervisord --version; fi

section "Panel and services"
if test -d /usr/local/ispconfig/server; then
  printf '%s\n' 'ISPConfig server directory: present'
else
  printf '%s\n' 'ISPConfig server directory: absent'
fi
for service in apache2 nginx postgresql supervisor mariadb ufw fail2ban docker; do
  if available systemctl; then
    printf '%-15s active=%s enabled=%s\n' "$service" \
      "$(systemctl is-active "$service" 2>/dev/null || true)" \
      "$(systemctl is-enabled "$service" 2>/dev/null || true)"
  fi
done

section "PostgreSQL clusters and Apache modules"
if available pg_lsclusters; then pg_lsclusters 2>/dev/null || true; fi
if available apache2ctl; then
  apache2ctl -M 2>/dev/null | grep -E '(proxy|headers|rewrite|ssl|http2)_module' || true
fi

section "Listening TCP ports (addresses reduced to bind scope)"
if available ss; then
  ss -H -lnt 2>/dev/null | awk '
    {
      address=$4
      if (address ~ /^127[.]0[.]0[.]1:/ || address ~ /^\[::1\]:/) scope="loopback"
      else if (address ~ /^(0[.]0[.]0[.]0:|\[::\]:|\*:)/) scope="wildcard"
      else scope="specific-address"
      sub(/^.*:/, "", address)
      if (address ~ /^[0-9]+$/) print scope, address
    }
  ' | sort -u
fi

if test -n "${SITE_ROOT:-}"; then
  section "Selected ISPConfig website paths"
  for path in "$SITE_ROOT" "$SITE_ROOT/web" "$SITE_ROOT/private"; do
    if test -e "$path"; then stat -c '%U:%G %a %n' -- "$path"; fi
  done
fi
if test -n "${SITE_USER:-}"; then
  section "Selected website user"
  id -- "$SITE_USER" 2>&1 || true
fi

section "Operator-supplied values still needed"
printf '%s\n' 'Website domain and environment; ISPConfig client/web IDs; selected site user/group; TLS state; chosen loopback port; database and backup owner; approved release SHA.'
