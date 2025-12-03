import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const ROOT = process.cwd();
const PID_FILE = path.join(ROOT, "logs", "router.pid");
const LOG_FILE = path.join(ROOT, "logs", "router.log");
const ROUTER_BIN = path.join(ROOT, "bin", "proxy-router");

async function isRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function POST() {
  try {
    const stats = await fs.stat(ROUTER_BIN);
    if (!stats.isFile()) {
      return NextResponse.json(
        { ok: false, error: "Router binary missing at bin/proxy-router" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "Router binary missing at bin/proxy-router" },
      { status: 400 },
    );
  }

  try {
    const pidContent = await fs.readFile(PID_FILE, "utf8").catch(() => "");
    const pid = Number(pidContent.trim());
    if (Number.isFinite(pid) && pid > 0 && (await isRunning(pid))) {
      return NextResponse.json({
        ok: true,
        message: `Router already running (pid ${pid})`,
      });
    }
  } catch {
    // ignore
  }

  try {
    await fs.mkdir(path.join(ROOT, "logs"), { recursive: true });
    const { stdout } = await execAsync(
      `bash -lc 'cd "${ROOT}" && "${ROUTER_BIN}" >> "${LOG_FILE}" 2>&1 & echo $!'`,
      { cwd: ROOT, env: { ...process.env } },
    );
    const pid = Number(stdout.trim());
    if (Number.isFinite(pid) && pid > 0) {
      await fs.writeFile(PID_FILE, `${pid}\n`, "utf8").catch(() => undefined);
      return NextResponse.json({ ok: true, message: `Router started (pid ${pid})` });
    }
    return NextResponse.json(
      { ok: false, error: "Router start command returned no pid" },
      { status: 500 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start router";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
