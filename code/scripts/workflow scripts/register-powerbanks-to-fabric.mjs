import fs from 'fs'
import { submitTransaction } from './fabric-utils.mjs'

const powerbanks = JSON.parse(fs.readFileSync('powerbanks.json', 'utf8'))

for (const pb of powerbanks) {
  await submitTransaction('RegisterPowerBank', pb.did, JSON.stringify(pb.publicKey), pb.passwordHash)
  console.log(`✅ Registered power bank: ${pb.did}`)
}
