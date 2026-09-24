import crypto from 'crypto'
import fs from 'fs'
import readline from 'readline'
import { Ed25519KeyPair } from '@transmute/did-key-ed25519'

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function createVC(holderDid, subjectData, privateKeyBytes, publicKeyBytes) {
  // The private key is 64 bytes and includes the public key; use the first 32 bytes as the pure private key
  const purePrivateKey = privateKeyBytes.slice(0, 32);
  // Construct a JWK private key. Ed25519 requires kty, crv, d, and x
  const privateKeyJwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    d: Buffer.from(purePrivateKey).toString('base64url'),
    x: Buffer.from(publicKeyBytes).toString('base64url')
  };
  const privateKey = crypto.createPrivateKey({ key: privateKeyJwk, format: 'jwk' });

  const header = { alg: 'EdDSA', typ: 'JWT' };
  const payload = {
    sub: holderDid,
    iss: holderDid,
    iat: Math.floor(Date.now() / 1000),
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'UserCredential'],
      credentialSubject: subjectData,
    },
  };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;
  const signature = crypto.sign(null, Buffer.from(message), privateKey);
  return `${message}.${base64url(signature)}`;
}

async function generateUser(name, trustScore) {
  const keyPair = await Ed25519KeyPair.generate({
    secureRandom: () => crypto.randomBytes(32)
  });
  const did = keyPair.controller;
  const subjectData = {
    id: did,
    name: name,
    role: 'user',
    initialTrustScore: trustScore,
    type: 'UserCredential'
  };
  const vc = createVC(did, subjectData, keyPair.privateKey, keyPair.publicKey);

  return {
    type: 'user',
    did,
    name,
    trustScore,
    vc,
    publicKey: {
      kty: 'OKP',
      crv: 'Ed25519',
      x: Buffer.from(keyPair.publicKey).toString('base64url')
    },
    privateKey: Buffer.from(keyPair.privateKey).toString('hex')
  };
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const users = [];
  const count = 1;
  for (let i = 1; i <= count; i++) {
    const name = await new Promise(resolve => {
      rl.question(`Please enter the name of user ${i}: `, answer => resolve(answer))
    });
    const trustScore = Number((0.8 + i * 0.05).toFixed(2));
    const user = await generateUser(name, trustScore);
    users.push(user);
    console.log(`✅ User ${i} (${name}) DID: ${user.did}`);
  }
  rl.close();

  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
  console.log('\n🎉 User entities have been saved to users.json');
}

main().catch(console.error);
