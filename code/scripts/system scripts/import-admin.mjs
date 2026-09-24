// import-admin.mjs
import { Wallets } from 'fabric-network'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Please confirm the "test-network" path based on the actual situation.
const testNetworkPath = '/mnt/d/MyProjects/charging-project/fabric-samples/test-network'
const org1Path = path.join(testNetworkPath, 'organizations/peerOrganizations/org1.example.com')

const certPath = path.join(org1Path, 'users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem')
const keyDir = path.join(org1Path, 'users/Admin@org1.example.com/msp/keystore')

console.log('certification path:', certPath)
console.log('Private key directory:', keyDir)

if (!fs.existsSync(certPath)) {
  throw new Error(`The certificate file does not exist.: ${certPath}`)
}

const certificate = fs.readFileSync(certPath).toString()

const keyFiles = fs.readdirSync(keyDir).filter(f => f.endsWith('_sk'))
if (keyFiles.length === 0) throw new Error('The private key file was not found.')
const keyPath = path.join(keyDir, keyFiles[0])
const privateKey = fs.readFileSync(keyPath).toString()

const identity = {
  credentials: { certificate, privateKey },
  mspId: 'Org1MSP',
  type: 'X.509',
}

const walletPath = '/tmp/wallet'
const wallet = await Wallets.newFileSystemWallet(walletPath)
await wallet.put('admin', identity)
console.log('✅ Identity has been imported into the wallet.')