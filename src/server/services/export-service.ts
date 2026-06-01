import type { Store } from "../types";

export async function createFullExportZip(store: Store, nowIso: string): Promise<Uint8Array> {
  const profile = await store.getProfile();
  const schemaVersion = (await store.getMeta("schema_version")) ?? "1";
  const events = await store.listEvents({ includeDeleted: true });
  const checklistItems = await store.listChecklistItems({ includeArchived: true });
  const milestones = await store.listMilestones();
  const attachments = await store.listAttachmentsManifest();

  return createZip([
    ["profile.json", json({ exported_at: nowIso, profile })],
    ["events.json", json(events)],
    ["events.csv", csv(events)],
    ["checklist_items.json", json(checklistItems)],
    ["checklist_items.csv", csv(checklistItems)],
    ["milestones.json", json(milestones)],
    ["milestones.csv", csv(milestones)],
    ["attachments_manifest.json", json(attachments)],
    ["schema_version.json", json({ schema_version: schemaVersion, exported_at: nowIso })]
  ]);
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function csv(rows: Array<object>): string {
  if (rows.length === 0) return "";
  const headerSet = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach((key) => headerSet.add(key));
  }
  const headers = Array.from(headerSet);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const record = row as Record<string, unknown>;
    lines.push(headers.map((header) => csvCell(record[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value: unknown): string {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function createZip(files: Array<[string, string]>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of files) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data
    ]);
    localParts.push(local);
    centralParts.push(concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes
    ]));
    offset += local.length;
  }

  const central = concat(centralParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0)
  ]);
  return concat([...localParts, central, end]);
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
