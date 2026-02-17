import type { DetailedPeerCertificate } from "node:tls";
import type { TlsCertificateData, TlsChainCertificate, TlsGrade } from "@penetragent/shared";
import { GRADE } from "../../grading/grade-config.js";
import { TLS_SCAN_CONFIG } from "./tls-scan-config.js";

interface CertificateAnalysis {
  certificate: TlsCertificateData;
  chain: TlsChainCertificate[];
  grades: TlsGrade[];
}

function extractSANs(cert: DetailedPeerCertificate): string[] {
  const altNames = cert.subjectaltname;
  if (!altNames) return [];
  return altNames.split(",").map((entry) => entry.trim().replace(/^DNS:/, ""));
}

function checkHostnameMatch(hostname: string, cert: DetailedPeerCertificate): boolean {
  const sans = extractSANs(cert);
  const cn = typeof cert.subject === "object" ? cert.subject.CN : undefined;
  const candidates = sans.length > 0 ? sans : cn ? [cn] : [];

  return candidates.some((name) => {
    if (name.startsWith("*.")) {
      const wildcardBase = name.slice(2);
      const hostParts = hostname.split(".");
      if (hostParts.length < 2) return false;
      return hostParts.slice(1).join(".") === wildcardBase;
    }
    return name.toLowerCase() === hostname.toLowerCase();
  });
}

function extractChain(cert: DetailedPeerCertificate): TlsChainCertificate[] {
  const chain: TlsChainCertificate[] = [];
  const seen = new Set<string>();
  let current = cert.issuerCertificate;

  while (current) {
    const fingerprint = current.fingerprint256 ?? current.fingerprint;
    if (!fingerprint || seen.has(fingerprint)) break;
    seen.add(fingerprint);

    const subject = typeof current.subject === "object" ? current.subject.CN ?? "" : "";
    const issuer = typeof current.issuer === "object" ? current.issuer.CN ?? "" : "";

    chain.push({
      subject,
      issuer,
      validFrom: current.valid_from,
      validTo: current.valid_to,
      isSelfSigned: subject === issuer,
    });

    current = current.issuerCertificate;
  }

  return chain;
}

export function analyzeCertificate(config: {
  cert: DetailedPeerCertificate;
  hostname: string;
}): CertificateAnalysis {
  const { cert, hostname } = config;
  const grades: TlsGrade[] = [];

  const subject = typeof cert.subject === "object" ? cert.subject.CN ?? "" : "";
  const issuer = typeof cert.issuer === "object" ? cert.issuer.CN ?? "" : "";
  const isSelfSigned = subject === issuer;
  const hostnameMatch = checkHostnameMatch(hostname, cert);
  const sans = extractSANs(cert);

  const validTo = new Date(cert.valid_to);
  const now = new Date();
  const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = daysUntilExpiry < 0;

  const certificate: TlsCertificateData = {
    subject,
    issuer,
    validFrom: cert.valid_from,
    validTo: cert.valid_to,
    daysUntilExpiry,
    isExpired,
    isSelfSigned,
    subjectAltNames: sans,
    hostnameMatch,
    serialNumber: cert.serialNumber,
    fingerprint: cert.fingerprint256 ?? cert.fingerprint,
  };

  if (isExpired) {
    grades.push({ check: "Certificate Validity", value: `Expired ${Math.abs(daysUntilExpiry)} days ago`, grade: GRADE.MISSING, reason: "Certificate expired" });
  } else if (daysUntilExpiry <= TLS_SCAN_CONFIG.certExpiryWarningDays) {
    grades.push({ check: "Certificate Validity", value: `Expires in ${daysUntilExpiry} days`, grade: GRADE.WEAK, reason: "Certificate expiring soon" });
  } else {
    grades.push({ check: "Certificate Validity", value: `Valid for ${daysUntilExpiry} days`, grade: GRADE.GOOD, reason: "Certificate is valid" });
  }

  if (isSelfSigned) {
    grades.push({ check: "Certificate Trust", value: "Self-signed", grade: GRADE.MISSING, reason: "Self-signed certificate" });
  } else {
    grades.push({ check: "Certificate Trust", value: `Issued by ${issuer}`, grade: GRADE.GOOD, reason: "CA-issued certificate" });
  }

  if (hostnameMatch) {
    grades.push({ check: "Hostname Match", value: hostname, grade: GRADE.GOOD, reason: "Hostname matches certificate" });
  } else {
    grades.push({ check: "Hostname Match", value: `${hostname} not in [${sans.join(", ")}]`, grade: GRADE.MISSING, reason: "Hostname mismatch" });
  }

  const chain = extractChain(cert);
  const chainComplete = chain.length > 0 && chain[chain.length - 1].isSelfSigned;
  if (chainComplete) {
    grades.push({ check: "Certificate Chain", value: `${chain.length} certificates`, grade: GRADE.GOOD, reason: "Complete chain to root CA" });
  } else {
    grades.push({ check: "Certificate Chain", value: `${chain.length} certificates`, grade: GRADE.WEAK, reason: "Certificate chain incomplete" });
  }

  return { certificate, chain, grades };
}
