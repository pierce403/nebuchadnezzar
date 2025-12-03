import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LOG_FILE = path.join(ROOT, "logs", "tunnel.log");
const PID_FILE = path.join(ROOT, "logs", "tunnel.pid");
const MAX_LOG_BYTES = 32 * 1024;

async function isRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  let pid = 0;
  let running = false;
  try {
    const pidContent = await fs.readFile(PID_FILE, "utf8");
    pid = Number(pidContent.trim());
    running = Number.isFinite(pid) && pid > 0 ? await isRunning(pid) : false;
  } catch {
    // ignore
  }

  let logSnippet = "";
  try {
    const stat = await fs.stat(LOG_FILE);
    const size = stat.size;
    const start = size > MAX_LOG_BYTES ? size - MAX_LOG_BYTES : 0;
    const fh = await fs.open(LOG_FILE, "r");
    const buf = Buffer.alloc(size - start);
    await fh.read(buf, 0, buf.length, start);
    await fh.close();
    logSnippet = buf.toString("utf8");
  } catch {
    logSnippet = "No tunnel log found. Run cloudflare-tunnel.sh.";
  }

  return NextResponse.json({
    ok: running,
    pid: running ? pid : undefined,
    message: running ? `Tunnel running (pid ${pid})` : "Tunnel not running",
    log: logSnippet,
  });
}
