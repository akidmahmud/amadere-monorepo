import { EmailTemplatesService } from './email-templates.service';

// Regression for the production email that rendered its header three times
// and showed a literal "{{ logo_html }}": `custom_css` held a pasted copy of
// the base header, and the renderer's second global pass expanded it again.
const BASE_HEADER =
  '<style>{{ custom_css }}</style><div class="hdr">{{ logo_html }}</div><div class="body">';
const BASE_FOOTER = '</div><div class="ftr">{{ copyright }}</div>';

function makeService(settings: Record<string, unknown>) {
  const prisma = {
    client: {
      emailTemplate: {
        findUnique: jest.fn(({ where }: { where: { key: string } }) =>
          Promise.resolve(
            where.key === 'core_base_header'
              ? { bodyHtml: BASE_HEADER }
              : where.key === 'core_base_footer'
                ? { bodyHtml: BASE_FOOTER }
                : null,
          ),
        ),
      },
      setting: { findUnique: jest.fn().mockResolvedValue(null) },
    },
  } as never;
  const service = new EmailTemplatesService(
    prisma,
    { getConfig: jest.fn().mockResolvedValue({ senderEmail: 'a@b.c' }) } as never,
  );
  jest.spyOn(service, 'getSettings').mockResolvedValue({
    logoUrl: 'https://cdn/logo.png',
    logoHeight: 40,
    copyright: 'amader',
    customCss: '',
    contactEmail: '',
    ...settings,
  } as never);
  return service;
}

async function render(service: EmailTemplatesService, body: string) {
  const out = await (
    service as unknown as {
      renderWithChrome: (
        b: string,
        s: string,
        v: Record<string, string>,
      ) => Promise<{ html: string }>;
    }
  ).renderWithChrome(body, 'subject', { order_id: 'ORD-1' });
  return out.html;
}

const BODY = '{{ header }}<p>Order {{ order_id }}</p>{{ footer }}';

describe('EmailTemplatesService chrome rendering', () => {
  it('renders the header exactly once with the logo resolved', async () => {
    const html = await render(makeService({}), BODY);
    expect(html.match(/class="hdr"/g)).toHaveLength(1);
    expect(html).toContain('https://cdn/logo.png');
    expect(html).toContain('Order ORD-1');
    expect(html).not.toMatch(/\{\{/);
  });

  it('does not multiply the header when custom_css holds pasted header HTML', async () => {
    // Exactly the production data that caused the bug.
    const html = await render(makeService({ customCss: BASE_HEADER }), BODY);

    // The pasted copy stays sealed inside <style>, inert and invisible.
    // What matters is the VISIBLE document: one header, and no leftover
    // token showing up as text in the customer's inbox. Before the fix this
    // rendered extra headers and a literal "{{ logo_html }}", because the
    // pasted value's own `</style>` closed the element and let the rest
    // escape into the document.
    const visible = html.replace(/<style>[\s\S]*?<\/style>/g, '');
    expect(visible.match(/class="hdr"/g)).toHaveLength(1);
    expect(visible).not.toContain('{{');
  });

  it('leaves an unknown token alone rather than blanking it', async () => {
    const html = await render(makeService({}), '{{ header }}{{ nope }}{{ footer }}');
    expect(html).toContain('{{ nope }}');
  });
});
