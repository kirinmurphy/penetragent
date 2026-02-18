import type { TlsReportData, TlsSummaryData, TlsGrade } from "@penetragent/shared";
import { GRADE, TLS_SCAN_CONFIG } from "../../config/scan-rules.js";
import { countGradeDistribution } from "../../grading/count-grades.js";
import { connectTls, testProtocolSupport } from "./connect.js";
import { analyzeCertificate } from "./analyze-certificate.js";
import { gradeProtocols } from "./analyze-protocol.js";
import { analyzeCipher } from "./analyze-cipher.js";

export async function runTlsScan(
  targetUrl: string,
): Promise<{ report: TlsReportData; summary: TlsSummaryData }> {
  const url = new URL(targetUrl);
  const host = url.hostname;
  const port = url.port ? parseInt(url.port, 10) : TLS_SCAN_CONFIG.port;

  const connection = await connectTls({ host, port });

  const certAnalysis = analyzeCertificate({
    cert: connection.peerCertificate,
    hostname: host,
  });

  const protocolResults = new Map<string, boolean>();
  for (const protocol of Object.keys(TLS_SCAN_CONFIG.protocolVersionMap)) {
    const versions = TLS_SCAN_CONFIG.protocolVersionMap[protocol as keyof typeof TLS_SCAN_CONFIG.protocolVersionMap];
    const supported = await testProtocolSupport({
      host,
      port,
      minVersion: versions.minVersion,
      maxVersion: versions.maxVersion,
    });
    protocolResults.set(protocol, supported);
  }

  const protocols = gradeProtocols(protocolResults);
  const cipher = analyzeCipher(connection.cipher);

  const allGrades: TlsGrade[] = [
    ...certAnalysis.grades,
    ...protocols.map((p) => ({
      check: `Protocol: ${p.protocol}`,
      value: p.supported ? "Supported" : "Not supported",
      grade: p.grade,
      reason: p.reason,
    })),
    {
      check: "Cipher Suite",
      value: cipher.name,
      grade: cipher.grade,
      reason: cipher.reason,
    },
  ];

  const findings = allGrades
    .filter((g) => g.grade !== GRADE.GOOD)
    .map((g) => g.reason);

  const criticalFindings = findings.filter((f) =>
    TLS_SCAN_CONFIG.criticalFindingPatterns.some((p) => f.includes(p)),
  );

  const { good, weak, missing } = countGradeDistribution(allGrades);

  const report: TlsReportData = {
    host,
    port,
    certificate: certAnalysis.certificate,
    chain: certAnalysis.chain,
    protocols,
    cipher,
    grades: allGrades,
    findings,
    timestamp: new Date().toISOString(),
  };

  const summary: TlsSummaryData = {
    host,
    good,
    weak,
    missing,
    criticalFindings,
  };

  return { report, summary };
}
