import { Injectable } from '@nestjs/common';
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    const [algorithm, saltEncoded, keyEncoded] = encoded.split('$');
    if (algorithm !== 'scrypt' || !saltEncoded || !keyEncoded) return false;

    const salt = Buffer.from(saltEncoded, 'base64url');
    const expected = Buffer.from(keyEncoded, 'base64url');
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;

    const actual = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    return timingSafeEqual(actual, expected);
  }
}
