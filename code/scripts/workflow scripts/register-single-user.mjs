import fs from 'fs'
import { submitTransaction } from './fabric-utils.mjs'

const users = JSON.parse(fs.readFileSync('users.json', 'utf8'))
const user = users[0]

console.log(`Registering user: ${user.did} (${user.name}), trust score: ${user.trustScore}`)

try {
  await submitTransaction('RegisterUser', user.did, user.name, user.trustScore.toString())
  console.log('✅ Registration successful')
} catch (err) {
  console.error('❌ Registration failed:', err.message)
}
