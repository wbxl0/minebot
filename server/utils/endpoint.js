const HOST_NOISE_RE = /[\x00-\x1F\x7F\u200B-\u200D\u2060\uFEFF]/g;
const HOST_SPACE_RE = /[\s\u00A0]/g;

export function normalizeServerEndpoint(hostValue, portValue, options = {}) {
  const defaultPort = options.defaultPort ?? 25565;
  const allowUndefinedPort = options.allowUndefinedPort === true;

  let host = String(hostValue ?? '')
    .normalize('NFKC')
    .replace(HOST_NOISE_RE, '')
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');

  const suffixIndex = host.search(/[/?#]/);
  if (suffixIndex >= 0) {
    host = host.slice(0, suffixIndex);
  }

  host = host.replace(HOST_SPACE_RE, '');

  let embeddedPort;
  const bracketMatch = host.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (bracketMatch) {
    host = bracketMatch[1];
    embeddedPort = bracketMatch[2];
  } else {
    const hostPortMatch = host.match(/^([^:]+):(\d+)$/);
    if (hostPortMatch) {
      host = hostPortMatch[1];
      embeddedPort = hostPortMatch[2];
    }
  }

  host = host.replace(/\.$/, '');

  const rawPort = embeddedPort !== undefined ? embeddedPort : portValue;
  const parsedPort = Number.parseInt(rawPort, 10);
  const validPort = Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort <= 65535;

  return {
    host,
    port: validPort ? parsedPort : (allowUndefinedPort ? undefined : defaultPort)
  };
}

export function normalizeHost(hostValue) {
  return normalizeServerEndpoint(hostValue, undefined, { allowUndefinedPort: true }).host;
}
