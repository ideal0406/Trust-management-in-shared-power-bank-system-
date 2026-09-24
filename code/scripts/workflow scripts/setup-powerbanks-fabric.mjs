import fs from 'fs'
import crypto from 'crypto'
import * as secrets from 'shamir-secret-sharing'
import { submitTransaction } from './fabric-utils.mjs'

// Read from powerbanks.json
const powerbanks = JSON.parse(fs.readFileSync('powerbanks.json', 'utf8'))

async function setup() {
    for (const pb of powerbanks) {
        // Generate a random password using 16 bytes in hex format
        const password = crypto.randomBytes(16).toString('hex')
        console.log(`PowerBank ${pb.did} unlock password: ${password}`)

        const secret = new TextEncoder().encode(password)
        const shares = await secrets.split(secret, 5, 3)
        const sharesB64 = shares.map(s => Buffer.from(s).toString('base64'))

        // Calculate the password hash
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex')

        // Store secret shares
        for (let i = 0; i < sharesB64.length; i++) {
            await submitTransaction('StoreSecretShare', pb.did, i.toString(), sharesB64[i])
            console.log(`  Share ${i} has been uploaded to the blockchain`)
        }

        // Update the password hash on the blockchain
        try {
            await submitTransaction('UpdatePowerBankPasswordHash', pb.did, passwordHash)
            console.log(`✅ Updated the password hash of ${pb.did} on the blockchain`)
        } catch (err) {
            console.error(`❌ Failed to update the password hash of ${pb.did}:`, err.message)
        }
    }
    console.log('✅ All power bank shares and password hashes have been uploaded to the blockchain')
}

setup().catch(console.error)
