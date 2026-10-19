import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMailbox, validateOutgoingEmail, validateSender } from '../lib/mail-safety.ts';

test('ordinary institutional and plus-addressed recipients are accepted', () => {
  assert.equal(validateMailbox(' officer+clear@example.edu.ph '), 'officer+clear@example.edu.ph');
  assert.equal(validateSender('CLEAR System <noreply@example.edu.ph>'), 'CLEAR System <noreply@example.edu.ph>');
  assert.equal(validateSender('noreply@example.edu.ph'), 'noreply@example.edu.ph');
});

test('ambiguous recipients and header injection are rejected', () => {
  for (const email of [
    'officer@trusted.edu.ph(other)attacker.com',
    'Officer <officer@example.edu.ph>',
    'a@example.edu.ph,attacker@evil.com',
    'a@example.edu.ph\nBcc:attacker@evil.com',
    'a@example.edu.ph\r\n',
    'a@example..edu.ph',
    'a@-example.edu.ph',
    'a@example.edu.ph;evil@example.edu.ph',
    'a@example.edu.ph ' + 'A'.repeat(300),
  ]) assert.throws(() => validateMailbox(email));
  assert.throws(() => validateSender('Name\r\nBcc: bad@example.edu <safe@example.edu.ph>'));
  assert.throws(() => validateOutgoingEmail({to:'admin@example.edu.ph',subject:'OTP\r\nBcc:',html:'test'}));
});

test('outgoing payload keeps one validated mailbox and preserves receipt HTML', () => {
  const m = validateOutgoingEmail({
    to:'user@example.edu.ph',subject:'CLEAR one-time password',
    html:'<b>123456</b>',text:'Your one-time password is 123456'
  });
  assert.equal(m.to,'user@example.edu.ph');
  assert.equal(m.html,'<b>123456</b>');
  assert.throws(() => validateOutgoingEmail({to:'x@example.edu.ph',subject:'Hi',html:''}));
});
