import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './dto/register.dto';

// A customer with no BD mobile registers on their email alone. The form
// submits the untouched phone box as "", and `@IsOptional()` only skips
// null/undefined — so the blank went on to fail the BD-phone format check and
// the signup was refused. Blank now means "not given".

const parse = (body: Record<string, unknown>) => {
  const dto = plainToInstance(RegisterDto, body);
  return { dto, errors: validateSync(dto).map((e) => e.property) };
};

const base = { firstName: 'Ayesha', lastName: 'Rahman', password: 'Passw0rd!23' };

describe('RegisterDto — mobile optional when an email is given', () => {
  it('accepts a blank phone alongside an email, and drops the blank', () => {
    const { dto, errors } = parse({ ...base, phone: '', email: 'a@example.com' });

    expect(errors).toEqual([]);
    expect(dto.phone).toBeUndefined();
  });

  it('accepts a phone with no email', () => {
    const { dto, errors } = parse({ ...base, phone: '01712345678', email: '' });

    expect(errors).toEqual([]);
    expect(dto.phone).toBe('8801712345678');
    expect(dto.email).toBeUndefined();
  });

  // Relaxing "must have one" must not relax "must be a real number".
  it('still rejects a phone that is typed but wrong', () => {
    expect(parse({ ...base, phone: '12345', email: 'a@example.com' }).errors).toEqual(['phone']);
  });

  // Both blank passes the DTO — register() is what answers "enter a mobile
  // number or an email address", so the message names the missing field.
  it('leaves both-blank for the service to refuse', () => {
    const { dto, errors } = parse({ ...base, phone: '', email: '' });

    expect(errors).toEqual([]);
    expect(dto.phone).toBeUndefined();
    expect(dto.email).toBeUndefined();
  });
});
