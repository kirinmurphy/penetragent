import tls from "node:tls";
import type { DetailedPeerCertificate, SecureVersion } from "node:tls";
import { TLS_SCAN_CONFIG } from "../../config/scan-rules.js";

export interface TlsConnectionResult {
  peerCertificate: DetailedPeerCertificate;
  protocol: string | null;
  cipher: { name: string; standardName: string; version: string };
  authorized: boolean;
  authorizationError: string | undefined;
}

export function connectTls(config: {
  host: string;
  port?: number;
  minVersion?: SecureVersion;
  maxVersion?: SecureVersion;
}): Promise<TlsConnectionResult> {
  const { host, port = TLS_SCAN_CONFIG.port } = config;

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
        minVersion: config.minVersion,
        maxVersion: config.maxVersion,
      },
      () => {
        const cert = socket.getPeerCertificate(true) as DetailedPeerCertificate;
        const protocol = socket.getProtocol();
        const cipher = socket.getCipher();
        const authError = socket.authorizationError;

        socket.destroy();
        resolve({
          peerCertificate: cert,
          protocol,
          cipher: {
            name: cipher.name,
            standardName: cipher.standardName ?? cipher.name,
            version: cipher.version,
          },
          authorized: socket.authorized,
          authorizationError: authError ? String(authError) : undefined,
        });
      },
    );

    socket.setTimeout(TLS_SCAN_CONFIG.connectionTimeoutMs, () => {
      socket.destroy();
      reject(new Error(`TLS connection to ${host}:${port} timed out`));
    });

    socket.on("error", (err) => {
      socket.destroy();
      reject(err);
    });
  });
}

export function testProtocolSupport(config: {
  host: string;
  port?: number;
  minVersion: SecureVersion;
  maxVersion: SecureVersion;
}): Promise<boolean> {
  return connectTls(config)
    .then(() => true)
    .catch(() => false);
}
