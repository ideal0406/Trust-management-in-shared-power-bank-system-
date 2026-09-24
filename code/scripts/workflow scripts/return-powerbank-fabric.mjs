// return-powerbank-fabric.mjs
import fs from 'fs'

const EVENT_FILE = 'events.json'

function appendEvent(userDID, powerbankDID, success) {
    let events = []
    if (fs.existsSync(EVENT_FILE)) {
        events = JSON.parse(fs.readFileSync(EVENT_FILE, 'utf8'))
    }
    events.push({
        user_did: userDID,
        powerbank_did: powerbankDID,
        success: success,
        timestamp: Date.now()
    })
    fs.writeFileSync(EVENT_FILE, JSON.stringify(events, null, 2))
    console.log(`✅ Reported return event: User ${userDID} returned ${powerbankDID}, state: ${success}`)
}

const userDID = process.argv[2]
const powerbankDID = process.argv[3]
const success = process.argv[4] === 'true'

if (!userDID || !powerbankDID || process.argv[4] === undefined) {
    console.error('Usage: node return-powerbank-fabric.mjs <userDID> <powerbankDID> <true/false>')
    process.exit(1)
}

appendEvent(userDID, powerbankDID, success)
