import { execFile } from "node:child_process";
import { createServerFn } from "@tanstack/react-start";

export type MoomooQuote = {
  ok: boolean;
  code: string;
  name: string;
  lastPrice: string;
  prevClose: string;
  updateTime: string;
  error: string;
};

function emptyQuote(error: string): MoomooQuote {
  return { ok: false, code: "", name: "", lastPrice: "", prevClose: "", updateTime: "", error };
}

export const getMoomooQuote = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const ticker = String((input as { ticker?: unknown })?.ticker ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9.]{1,16}$/.test(ticker)) throw new Error("无效代码");
    return { ticker };
  })
  .handler(async ({ data }): Promise<MoomooQuote> => {
    const script = `${process.cwd()}/scripts/moomoo_quote.py`;
    try {
      const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
        execFile(
          "python3",
          [script, data.ticker],
          { timeout: 8000 },
          (error, stdout, stderr) => {
            if (error) reject(new Error(stderr || error.message));
            else resolve({ stdout });
          },
        );
      });
      const parsed = JSON.parse(stdout) as Partial<MoomooQuote>;
      return {
        ok: Boolean(parsed.ok),
        code: String(parsed.code ?? ""),
        name: String(parsed.name ?? ""),
        lastPrice: String(parsed.lastPrice ?? ""),
        prevClose: String(parsed.prevClose ?? ""),
        updateTime: String(parsed.updateTime ?? ""),
        error: String(parsed.error ?? ""),
      };
    } catch (error) {
      return emptyQuote(error instanceof Error ? error.message : "行情接口失败");
    }
  });
