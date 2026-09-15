import { BadRequestException } from '@nestjs/common';

// Custom fields an admin defines per wholesale channel (Channel Settings), and
// the values an order stores for them. Kept free of Prisma so the rules can be
// tested on their own (wholesale-channel-fields.spec.ts).

export const CHANNEL_FIELD_TYPES = ['text', 'number', 'date', 'select'] as const;
export type ChannelFieldType = (typeof CHANNEL_FIELD_TYPES)[number];

export interface ChannelField {
  /** Fixed once created, so renaming the label never orphans stored values. */
  key: string;
  label: string;
  type: ChannelFieldType;
  required: boolean;
  showInTable: boolean;
  /** Choices for a `select` field. */
  options?: string[];
}

export type ChannelValues = Record<string, string | number>;

/**
 * Cleans a field list from the settings form: trimmed labels, a stable key for
 * every field (kept when the field already has one, derived from the label
 * for a new one), no duplicate keys, and a select always has options.
 */
export function normalizeChannelFields(
  input: { key?: string; label: string; type: ChannelFieldType; required?: boolean; showInTable?: boolean; options?: string[] }[],
): ChannelField[] {
  const used = new Set<string>();
  return input.map((f) => {
    const label = f.label.trim();
    if (!label) throw new BadRequestException('Every field needs a name');
    let key = f.key && /^[a-z0-9_]{1,40}$/.test(f.key) ? f.key : slug(label);
    if (used.has(key)) {
      if (f.key) throw new BadRequestException(`Two fields share the key "${key}"`);
      let n = 2;
      while (used.has(`${key}_${n}`)) n++;
      key = `${key}_${n}`;
    }
    used.add(key);

    const field: ChannelField = { key, label, type: f.type, required: !!f.required, showInTable: !!f.showInTable };
    if (f.type === 'select') {
      const options = [...new Set((f.options ?? []).map((o) => o.trim()).filter(Boolean))];
      if (!options.length) throw new BadRequestException(`"${label}" is a dropdown, so it needs at least one option`);
      field.options = options;
    }
    return field;
  });
}

/**
 * Checks an order's values against its channel's fields and returns what is
 * stored: known keys only, typed, empty ones dropped — plus the values as one
 * search string. A required field left empty is refused with its label.
 */
export function validateChannelValues(
  fields: ChannelField[],
  raw: Record<string, unknown> | null | undefined,
): { values: ChannelValues; search: string | null } {
  const values: ChannelValues = {};
  for (const f of fields) {
    const v = raw?.[f.key];
    const text = v === null || v === undefined ? '' : String(v).trim();
    if (!text) {
      if (f.required) throw new BadRequestException(`${f.label} is required`);
      continue;
    }
    switch (f.type) {
      case 'number': {
        const n = Number(text);
        if (!Number.isFinite(n)) throw new BadRequestException(`${f.label} must be a number`);
        values[f.key] = n;
        break;
      }
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(text).getTime())) {
          throw new BadRequestException(`${f.label} must be a date`);
        }
        values[f.key] = text;
        break;
      case 'select':
        if (!f.options?.includes(text)) throw new BadRequestException(`${f.label} must be one of: ${f.options?.join(', ')}`);
        values[f.key] = text;
        break;
      default:
        if (text.length > 500) throw new BadRequestException(`${f.label} is too long`);
        values[f.key] = text;
    }
  }
  const search = Object.values(values).join(' ');
  return { values, search: search || null };
}

/** The JSON column read back as fields; anything malformed is ignored. */
export function channelFieldsOf(json: unknown): ChannelField[] {
  return Array.isArray(json) ? (json as ChannelField[]).filter((f) => f && typeof f.key === 'string') : [];
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'field';
}
