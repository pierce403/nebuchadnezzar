import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function POST() {
  const cwd = process.cwd();
  const scriptPath = path.join(cwd, "setup.sh");

  try {
    const { stdout, stderr } = await execAsync(`bash "${scriptPath}"`, {
      cwd,
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024,
    });

    return NextResponse.json({
      ok: true,
      output: [stdout, stderr].filter(Boolean).join("\n").trim(),
    });
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    const stdout = err?.stdout ?? "";
    const stderr = err?.stderr ?? err?.message ?? "Unknown error";
    return NextResponse.json({
      ok: false,
      output: [stdout, stderr].filter(Boolean).join("\n").trim(),
    });
  }
}
