import crypto from 'crypto'
import fs from 'fs'
import { Ed25519KeyPair } from '@transmute/did-key-ed25519'

async function generatePowerBank() {
  const entities = []
  // Generate 5 power banks
  for (let i = 1; i <= 5; i++) {
    const keyPair = await Ed25519KeyPair.generate({
      secureRandom: () => crypto.randomBytes(32)
    })
    const did = keyPair.controller
    const password = crypto.randomBytes(16).toString('hex')
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex')

    entities.push({
      type: 'powerbank',
      did,
      publicKey: {
        kty: 'OKP',
        crv: 'Ed25519',
        x: Buffer.from(keyPair.publicKey).toString('base64url')
      },
      privateKey: Buffer.from(keyPair.privateKey).toString('hex'),
      password,
      passwordHash
    })
    console.log(`✅ Power bank ${i} DID: ${did}`)
  }

  fs.writeFileSync('powerbanks.json', JSON.stringify(entities, null, 2))
  console.log('\n🎉 Power bank entities have been saved to powerbanks.json')
}

generatePowerBank().catch(console.error)
