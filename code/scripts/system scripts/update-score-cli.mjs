#!/usr/bin/env node
import { submitTransaction } from './fabric-utils.mjs'

const userDID = process.argv[2];
const newScore = process.argv[3];
if (!userDID || !newScore) {
    console.error('Usage: node update-score-cli.mjs <userDID> <newScore>');
    process.exit(1);
}
submitTransaction('UpdateTrustScore', userDID, newScore)
    .then(() => console.log(`✅ Updated score for ${userDID} to ${newScore}`))
    .catch(err => {
        console.error('❌ Update failed:', err.message);
        process.exit(1);
    });
