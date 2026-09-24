// fabric-utils.mjs
import { Gateway, Wallets } from 'fabric-network'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Connection profile file path. Please verify it according to your actual environment.
const ccpPath = '/mnt/d/MyProjects/charging-project/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json'
const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'))
const walletPath = '/tmp/wallet'

export async function submitTransaction(fcn, ...args) {
    const gateway = new Gateway()
    try {
        const wallet = await Wallets.newFileSystemWallet(walletPath)
        await gateway.connect(ccp, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: true }
        })
        const network = await gateway.getNetwork('mychannel')
        const contract = network.getContract('trustmgmtv2')
        const result = await contract.submitTransaction(fcn, ...args)
        return result
    } catch (error) {
        console.error(`❌ Failed to submit transaction [${fcn}]:`, error.message)
        throw error
    } finally {
        gateway.disconnect()
    }
}

export async function evaluateTransaction(fcn, ...args) {
    const gateway = new Gateway()
    try {
        const wallet = await Wallets.newFileSystemWallet(walletPath)
        await gateway.connect(ccp, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: true }
        })
        const network = await gateway.getNetwork('mychannel')
        const contract = network.getContract('trustmgmtv2')
        const result = await contract.evaluateTransaction(fcn, ...args)
        return result
    } catch (error) {
        console.error(`❌ Failed to query [${fcn}]:`, error.message)
        throw error
    } finally {
        gateway.disconnect()
    }
}
