import type { Context } from "grammy";
import type { ScannerClient } from "../../scanner-client/client.js";
import { formatHumanDate } from "../utils/format-date.js";
import { groupJobsByTarget } from "../utils/group-history.js";
import { detectIdentifier } from "../utils/detect-identifier.js";
import { sendChunked } from "../utils/send-chunked.js";
import { resolveTargetId, buildTargetUrl } from "../utils/resolve-target-id.js";
import { INPUT_ALL, IDENTIFIER_TYPE, CHAT_ACTION } from "../constants.js";
export async function handleHistory(params: {
  ctx: Context;
  args: string[];
  client: ScannerClient;
}): Promise<void> {
  const { ctx, args, client } = params;
  try {
    await ctx.api.sendChatAction(ctx.chat!.id, CHAT_ACTION.TYPING);

    if (args.length === 0 || !isNaN(Number(args[0]))) {
      await showRecentScans(ctx, args, client);
      return;
    }

    const identifier = args[0];

    if (identifier === INPUT_ALL) {
      await showAllScans(ctx, client);
      return;
    }

    const detected = detectIdentifier(identifier);

    if (detected.type === IDENTIFIER_TYPE.JOB_ID) {
      await showJobDetail(ctx, detected.value, client);
      return;
    }

    if (detected.type === IDENTIFIER_TYPE.URL || detected.type === IDENTIFIER_TYPE.TARGET_ID) {
      await showTargetHistory(ctx, detected, client);
      return;
    }

    await showRecentScans(ctx, args, client);
  } catch {
    await ctx.reply("Could not fetch scan history.");
  }
}

async function showAllScans(ctx: Context, client: ScannerClient): Promise<void> {
  const { jobs } = await client.listJobs({ limit: 1000 });

  if (jobs.length === 0) {
    await ctx.reply("No scan history found.");
    return;
  }

  const header = `All scans (${jobs.length} total):\n`;
  await sendChunked(ctx, header, jobs.map(formatJobLine));
}

async function showJobDetail(ctx: Context, jobId: string, client: ScannerClient): Promise<void> {
  const job = await client.getJob(jobId);
  const date = formatHumanDate(job.createdAt);
  const lines = [
    `Job ${job.jobId.slice(0, 8)}…`,
    `Target: ${job.targetId}`,
    `Scan Type: ${job.scanType}`,
    `Status: ${job.status}`,
    `Created: ${date}`,
  ];
  await ctx.reply(lines.join("\n"));
}

async function showTargetHistory(
  ctx: Context,
  detected: { type: string; value: string },
  client: ScannerClient,
): Promise<void> {
  let targetId = detected.value;
  if (detected.type === IDENTIFIER_TYPE.URL) {
    const resolved = resolveTargetId(detected.value);
    targetId = resolved.ok ? resolved.targetId : detected.value;
  }

  const { jobs } = await client.listJobsByTarget({ targetId });

  if (jobs.length === 0) {
    await ctx.reply(`No scans found for ${targetId}`);
    return;
  }

  const header = `All scans for ${targetId} (${jobs.length} total):\n`;
  await sendChunked(ctx, header, jobs.map(formatJobLine));
}

async function showRecentScans(ctx: Context, args: string[], client: ScannerClient): Promise<void> {
  const limit = args.length > 0 && !isNaN(Number(args[0]))
    ? Math.min(1000, parseInt(args[0], 10))
    : 100;
  const { jobs } = await client.listJobs({ limit });

  if (jobs.length === 0) {
    await ctx.reply("No scan history found.");
    return;
  }

  const jobsWithUrl = jobs.map((j) => ({
    jobId: j.jobId,
    targetId: j.targetId,
    targetUrl: buildTargetUrl(j.targetId),
    status: j.status,
    createdAt: j.createdAt,
  }));

  const groups = groupJobsByTarget(jobsWithUrl, 10);
  const lines: string[] = [];

  for (const group of groups) {
    const date = formatHumanDate(group.latestDate);

    lines.push(`${date} | ${group.targetId} | ${group.latestStatus}`);
    lines.push(`  Use \`status ${group.latestJobId}\` for full details`);

    if (group.totalScans > 1) {
      lines.push(
        `  Latest of ${group.totalScans} scans - use \`history ${group.targetId}\` to see all\n`,
      );
    } else {
      lines.push("");
    }
  }

  const header = `Recent scans (${groups.length} unique targets):\n`;
  await sendChunked(ctx, header, lines);
}

function formatJobLine(job: { jobId: string; targetId: string; scanType: string; status: string; createdAt: string }): string {
  const date = formatHumanDate(job.createdAt);
  return `${date} | ${job.targetId} | ${job.scanType} | ${job.status}\n  Use \`status ${job.jobId}\` for full details\n`;
}
