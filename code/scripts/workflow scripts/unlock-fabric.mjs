#!/usr/bin/env node
import fs from 'fs'
import crypto from 'crypto'
import * as secrets from 'shamir-secret-sharing'
import { jwtVerify } from 'jose'
import { evaluateTransaction } from './fabric-utils.mjs'

// === Key fix 2: Set a Web Crypto polyfill for jose. This is cleaner than manually using importKey. ===
globalThis.crypto = crypto.webcrypto

// Verify the VC using the public key in the local users.json file
async function verifyVC(userDID, vc) {
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'))
  const user = users.find(u => u.did === userDID)
  if (!user) throw new Error(`User not found ${userDID} public key`)
  const publicKeyJwk = user.publicKey

  // ====================== Additional debug information for troubleshooting ======================
  console.log('🔍 VC verification has begun....')
  console.log(' User DID :', userDID)
  console.log(' Public key JWK :', JSON.stringify(publicKeyJwk, null, 2))
  console.log(' VC JWT length :', vc.length)
  console.log(' VC The first 200 characters :', vc.substring(0, 200) + (vc.length > 200 ? '...' : ''))
  // =====================================================================

  const { payload } = await jwtVerify(vc, publicKeyJwk, { algorithms: ['EdDSA'] })

  if (payload.sub !== userDID) throw new Error('The DID in the VC does not match the parameters.')
  return payload
}

// === Enhanced option 1: The trust score determines the deposit, rental discount, simultaneous borrowing limit, and fast-charging benefit ===
function computeCreditParams(trustScore) {
  if (trustScore >= 0.9) {
    return {
      deposit: 0,
      discount: 0.8,
      maxSimultaneous: 3,
      level: 'VIP',
      fastCharge: true
    }
  }
  if (trustScore >= 0.7) {
    return {
      deposit: 49,
      discount: 0.9,
      maxSimultaneous: 2,
      level: 'common',
      fastCharge: false
    }
  }
  return {
    deposit: 99,
    discount: 1.0,
    maxSimultaneous: 1,
    level: 'basic',
    fastCharge: false
  }
}

async function unlock(userDID, powerbankDID, userVC) {
  try {
    // 1. Verify the VC
    console.log('Verifying the user credentials...')
    const vcPayload = await verifyVC(userDID, userVC)
    console.log(`✅ VC verification successful. User name: ${vcPayload.vc.credentialSubject.name}`)

    // 2. Get the latest trust score from the blockchain
    const scoreBuffer = await evaluateTransaction('GetTrustScore', userDID)
    const trustScore = parseFloat(scoreBuffer.toString())
    console.log(`Chain-based trust score: ${trustScore}`)

    // === New logic: Calculate business benefits based on the trust score, including the fast-charging benefit ===
    const params = computeCreditParams(trustScore)
    console.log(`💰 Credit rights calculation completed：`)
    console.log(`   grade: ${params.level}`)
    console.log(`   deposit: ${params.deposit} CNY`)
    console.log(`   rent discount: ${(params.discount * 100).toFixed(0)}%`)
    console.log(`   the upper limit: ${params.maxSimultaneous} items`)
    if (params.fastCharge) {
      console.log(`   ⚡ Fast charging benefits: Activated (charging speed has been increased by 30% to 50%)`)
    }

    // 3. Get power bank shares. Use the first 3 shares for better stability and reliability.
    const sharesBuffer = await evaluateTransaction('GetSecretShares', powerbankDID)
    const sharesMap = JSON.parse(sharesBuffer.toString())
    const shares = Object.values(sharesMap)
    console.log(`Obtained ${shares.length} shards from the chain`)

    if (shares.length < 3) {
      throw new Error(`Insufficient segmentation (3 segments are needed, but only ${shares.length} ）`)
    }

    // 4. Select the first 3 shares and reconstruct the password
    const selected = shares.slice(0, 3).map(s => new Uint8Array(Buffer.from(s, 'base64')))
    console.log(`Actual number of shards used: ${selected.length}`)
    const reconstructed = await secrets.combine(selected)
    const password = new TextDecoder().decode(reconstructed)
    console.log(`Reconstruct the password: ${password}`)

    // 5. Get the password hash from the blockchain and verify it
    const hashBuffer = await evaluateTransaction('GetPowerBankPasswordHash', powerbankDID)
    const chainHash = hashBuffer.toString()
    const hash = crypto.createHash('sha256').update(password).digest('hex')

    if (hash === chainHash) {
      console.log(`✅ Unlock successful! Matching power bank ${powerbankDID}`)

      // === After a successful unlock, display the fast-charging benefit notice. The actual fast-charging logic is not implemented here. ===
      if (params.fastCharge) {
        console.log(`🚀 High credit users will enjoy the fast charging benefit! This charging session will automatically switch to the fast charging mode, providing a faster and more time-saving experience!`)
      }

      // === Key step: Record the credit benefits for this rental. A new blockchain transaction is recommended later. ===
      console.log('📝 The current lease credit parameters are being recorded....')
      // TODO: If you have an invokeTransaction function, call it here:
      // await invokeTransaction('StartRental', userDID, powerbankDID,
      //   JSON.stringify({ deposit: params.deposit, discount: params.discount, fastCharge: params.fastCharge }))

      console.log(`🎟   This lease has fully vested all rights and benefits in favor of the credit party, and can be directly utilized.！`)

    } else {
      console.log('❌ Password incorrect. Unlock failed.')
    }

  } catch (err) {
    console.error('❌ Unlock failed:', err.message)
    console.error(err.stack)
  }
}

const [,, userDID, powerbankDID, userVC] = process.argv
if (!userDID || !powerbankDID || !userVC) {
  console.error('Usage: node unlock-fabric.mjs <userDID> <powerbankDID> "<VC string>"')
  process.exit(1)
}

unlock(userDID, powerbankDID, userVC).catch(console.error)