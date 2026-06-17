import crypto from 'crypto';

interface JwtKeys {
  publicKey: crypto.KeyObject;
  privateKey: crypto.KeyObject;
  jwk: {
    kty: string;
    n: string;
    e: string;
    kid: string;
    alg: string;
    use: string;
  };
}

let keys: JwtKeys | null = null;

export function getKeys(): JwtKeys {
  if (!keys) {
    const globalKeys = (globalThis as any).jwtKeys;
    if (globalKeys) {
      keys = globalKeys;
    } else {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      const jwk = publicKey.export({ format: 'jwk' }) as any;
      jwk.kid = 'forge-portal-key-1';
      jwk.alg = 'RS256';
      jwk.use = 'sig';

      keys = {
        publicKey,
        privateKey,
        jwk,
      };
      (globalThis as any).jwtKeys = keys;
    }
  }
  return keys!;
}
