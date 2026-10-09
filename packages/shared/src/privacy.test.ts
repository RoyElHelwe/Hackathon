import { buildTokenizer } from './privacy';

const people = [
  { id: 'h', name: 'Hassan Merhi', kind: 'staff' as const },
  { id: 'r', name: 'Rana Khoury', kind: 'staff' as const },
  { id: 'n', name: 'Georges Nassar', kind: 'staff' as const },
  { id: 'k', name: 'Karim Khoury', kind: 'staff' as const },
  { id: 'l', name: 'Lea Saliba', kind: 'student' as const },
];

describe('privacy tokenizer', () => {
  it('replaces full names, honorific + last name and unique first names', () => {
    const t = buildTokenizer(people);
    const enc = t.encode('Mr. Merhi is sick; ask Georges Nassar or Rana to cover. Lea is fine.');
    expect(enc).not.toMatch(/Merhi|Nassar|Rana|Lea/);
    expect(enc).toMatch(/T\d .*T\d/);
    expect(enc).toContain('S1');
    expect(t.idOf(enc.match(/T\d+/)![0])).toBe('h');
    expect(t.decode(enc)).toContain('Hassan Merhi');
  });

  it('tokenizes emails and decodes them back', () => {
    const t = buildTokenizer(people);
    const enc = t.encode('Invite nadine.f@school.lb to teach math');
    expect(enc).toBe('Invite E1 to teach math');
    expect(t.emailOf('E1')).toBe('nadine.f@school.lb');
    expect(t.decode('Sent to E1')).toBe('Sent to nadine.f@school.lb');
  });

  it('handles Arabic honorifics and text', () => {
    const t = buildTokenizer([{ id: 'm', name: 'مايا حايك', kind: 'staff' }]);
    const enc = t.encode('الأستاذة حايك غائبة غداً');
    expect(enc).not.toContain('حايك');
    expect(t.idOf(enc.split(' ')[0])).toBe('m');
  });

  it('flags ambiguous surnames instead of guessing', () => {
    const t = buildTokenizer(people);
    const enc = t.encode('Mrs Khoury is absent');
    const tok = enc.match(/T\?\d+/)![0];
    expect(t.ambiguous(tok)?.sort()).toEqual(['k', 'r']);
  });

  it('does not touch words that only contain a name', () => {
    const t = buildTokenizer([{ id: 'x', name: 'Sam Ali', kind: 'staff' }]);
    expect(t.encode('Alibaba sale')).toBe('Alibaba sale');
  });
});
