// reset-system.mjs
import fs from 'fs'
import { submitTransaction } from './fabric-utils.mjs'

async function clearChaincodeData() {
  try {
    await submitTransaction('ClearAllData')
    console.log('✅ The data on the chain has been cleared.')
  } catch (err) {
    if (err.message.includes('unknown function') || err.message.includes('not found')) {
      console.error('❌ The ClearAllData method is not implemented in the chain code. Please first add and redeploy the chain code.')
    } else {
      console.error('❌ Failed to clear the data on the blockchain:', err.message)
    }
    process.exit(1)
  }
}

function deleteLocalFiles() {
  const files = ['users.json', 'powerbanks.json', 'events.json', 'ledger.json', 'real-entities.json']
  for (const file of files) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
      console.log(`🗑️ The local file has been deleted. ${file}`)
    }
  }
  console.log('✅ Local files have been cleared.')
}

async function main() {
  console.log('Start resetting the system...')
  await clearChaincodeData()
  deleteLocalFiles()
  console.log('System reset completed! Please re-run the generate-users.mjs and generate-powerbanks.mjs scripts to generate new data.')
}

main().catch(console.error)