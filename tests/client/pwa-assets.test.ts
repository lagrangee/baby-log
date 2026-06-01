import { describe, expect, test } from "vitest";

declare const require: (name: string) => {
  readFileSync?: (path: string, encoding?: string) => string;
  statSync?: (path: string) => { size: number };
  join?: (...paths: string[]) => string;
};
declare const process: { cwd: () => string };

const { readFileSync, statSync } = require("node:fs") as {
  readFileSync: (path: string, encoding?: string) => string;
  statSync: (path: string) => { size: number };
};
const { join } = require("node:path") as { join: (...paths: string[]) => string };
const root = process.cwd();

describe("pwa home screen assets", () => {
  test("index declares manifest and apple touch icon metadata", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");

    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Baby Log" />');
    expect(html).toContain('<meta name="theme-color" content="#1f8a70" />');
  });

  test("manifest declares install icons for Android and standalone display", () => {
    const manifest = JSON.parse(readFileSync(join(root, "public", "manifest.webmanifest"), "utf8")) as {
      name?: string;
      display?: string;
      icons?: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    };

    expect(manifest.name).toBe("Baby Log");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" })
      ])
    );
  });

  test("touch and manifest icon files are present", () => {
    for (const file of ["public/apple-touch-icon.png", "public/icons/icon-192.png", "public/icons/icon-512.png", "public/favicon.svg"]) {
      expect(statSync(join(root, file)).size).toBeGreaterThan(100);
    }
  });
});
