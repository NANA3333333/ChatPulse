const dns = require('dns').promises;
const net = require('net');

function isPublicMode() {
    return /^(1|true|yes|on)$/i.test(String(process.env.CP_PUBLIC_MODE || ''));
}

function normalizeHostname(value) {
    return String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function isPrivateIpv4(hostname) {
    const parts = hostname.split('.').map(part => Number(part));
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    const [a, b] = parts;
    return a === 0
        || a === 10
        || a === 127
        || (a === 100 && b >= 64 && b <= 127)
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)
        || (a === 198 && (b === 18 || b === 19))
        || a >= 224;
}

function isPrivateIpv6(hostname) {
    const clean = normalizeHostname(hostname);
    return clean === '::'
        || clean === '::1'
        || clean.startsWith('fc')
        || clean.startsWith('fd')
        || clean.startsWith('fe80:')
        || clean.startsWith('::ffff:127.')
        || clean.startsWith('::ffff:10.')
        || clean.startsWith('::ffff:192.168.')
        || /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(clean);
}

function isBlockedPrivateNetworkHost(hostname) {
    const clean = normalizeHostname(hostname);
    if (!clean) return true;
    if (clean === 'localhost' || clean.endsWith('.localhost') || clean.endsWith('.local')) return true;
    const ipVersion = net.isIP(clean);
    if (ipVersion === 4) return isPrivateIpv4(clean);
    if (ipVersion === 6) return isPrivateIpv6(clean);
    return false;
}

function validationError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function normalizeServerFetchUrl(value, label = 'URL', options = {}) {
    let parsed;
    try {
        parsed = new URL(String(value || '').trim());
    } catch (e) {
        throw validationError(`${label} is invalid`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw validationError(`${label} must be http or https`);
    }
    const allowPrivateHosts = options.allowPrivateHosts ?? !isPublicMode();
    if (!allowPrivateHosts && isBlockedPrivateNetworkHost(parsed.hostname)) {
        throw validationError(`${label} host is not allowed in public mode`);
    }
    return parsed;
}

async function normalizeServerFetchUrlResolved(value, label = 'URL', options = {}) {
    const parsed = normalizeServerFetchUrl(value, label, options);
    const allowPrivateHosts = options.allowPrivateHosts ?? !isPublicMode();
    if (allowPrivateHosts) return parsed;

    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname || net.isIP(hostname)) return parsed;

    let records;
    try {
        records = await dns.lookup(hostname, { all: true, verbatim: false });
    } catch (e) {
        throw validationError(`${label} host could not be resolved`);
    }

    if (!records?.length) {
        throw validationError(`${label} host could not be resolved`);
    }
    if (records.some(record => isBlockedPrivateNetworkHost(record.address))) {
        throw validationError(`${label} resolves to a private network address in public mode`);
    }
    return parsed;
}

function applyOpenAiCompatiblePath(parsed, suffix) {
    parsed.hash = '';
    parsed.search = '';
    let pathname = parsed.pathname.replace(/\/+$/, '');
    if (pathname.endsWith('/chat/completions')) {
        pathname = pathname.slice(0, -'/chat/completions'.length);
    }
    const cleanSuffix = String(suffix || '').replace(/^\/+/, '');
    parsed.pathname = `${pathname || ''}/${cleanSuffix}`;
    return parsed.toString();
}

function buildOpenAiCompatibleUrl(endpoint, suffix, options = {}) {
    return applyOpenAiCompatiblePath(normalizeServerFetchUrl(endpoint, options.label || 'Endpoint', options), suffix);
}

async function buildOpenAiCompatibleUrlResolved(endpoint, suffix, options = {}) {
    const parsed = await normalizeServerFetchUrlResolved(endpoint, options.label || 'Endpoint', options);
    return applyOpenAiCompatiblePath(parsed, suffix);
}

module.exports = {
    buildOpenAiCompatibleUrlResolved,
    buildOpenAiCompatibleUrl,
    isBlockedPrivateNetworkHost,
    isPublicMode,
    normalizeServerFetchUrl,
    normalizeServerFetchUrlResolved
};
