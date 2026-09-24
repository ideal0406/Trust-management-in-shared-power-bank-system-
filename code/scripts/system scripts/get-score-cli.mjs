#!/usr/bin/env node
import { evaluateTransaction } from './fabric-utils.mjs'

const userDID = process.argv[2];
if (!userDID) {
    console.error('Usage: node get-score-cli.mjs <userDID>');
    process.exit(1);
}
evaluateTransaction('GetTrustScore', userDID)
    .then(buf => console.log(parseFloat(buf.toString())))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
