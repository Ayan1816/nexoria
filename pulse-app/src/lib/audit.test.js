import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('the app no longer calls the unverified factory or a CDN ethers build', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
  const payments = readFileSync(new URL('./payments.js', import.meta.url), 'utf8')
  const firebase = readFileSync(new URL('./firebase.js', import.meta.url), 'utf8')
  const combined = `${app}\n${payments}\n${firebase}`
  assert.equal(combined.includes('0x50Fc27E539EcfbdAC883Cd2b68a7EA2c992652c6'), false)
  assert.equal(combined.includes('cdnjs'), false)
  assert.equal(combined.includes('AIzaSy'), false)
  assert.equal(combined.includes('parseEther'), false)
  assert.equal(combined.includes('Coming Soon'), false)
  assert.equal(app.includes('SYNCING'), false)
  assert.equal(payments.includes('getGasPrice'), false)
  assert.equal(payments.includes('getFeeData'), true)
  assert.equal(payments.includes('isBlacklisted'), true)
  assert.equal(payments.includes('REVERTED'), true)
  assert.equal(combined.includes('Cloud sign-in failed'), false)
  assert.equal(combined.includes('Cloud sync is off'), false)
  assert.equal(app.includes('parsePaymentCommands'), false)
  assert.equal(app.includes('Send USDC'), true)
  assert.equal(app.includes('Send EURC'), true)
  assert.equal(app.includes('Recipient address'), true)
})

test('the token artifact is compiled bytecode', () => {
  const artifact = JSON.parse(readFileSync(new URL('../contracts/FixedSupplyToken.json', import.meta.url), 'utf8'))
  assert.equal(artifact.bytecode.startsWith('0x'), true)
  assert.equal(artifact.bytecode.length > 100, true)
  const constructor = artifact.abi.find((entry) => entry.type === 'constructor')
  assert.deepEqual(constructor.inputs.map((input) => input.name), ['tokenName', 'tokenSymbol', 'wholeSupply', 'recipient'])
})
