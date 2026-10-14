import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const require = createRequire(resolve(root, '../pulse-app/package.json'))
const solc = require('solc')
const tokenSource = readFileSync(resolve(root, 'src/FixedSupplyToken.sol'), 'utf8')
const factorySource = readFileSync(resolve(root, 'src/NexoriaTokenFactory.sol'), 'utf8')

const input = {
  language: 'Solidity',
  sources: {
    'FixedSupplyToken.sol': { content: tokenSource },
    'NexoriaTokenFactory.sol': { content: factorySource },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'cancun',
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
  },
}

const output = JSON.parse(solc.compile(JSON.stringify(input)))
const errors = (output.errors ?? []).filter((error) => error.severity === 'error')
if (errors.length > 0) {
  for (const error of errors) console.error(error.formattedMessage)
  process.exit(1)
}

function artifact(fileName, contractName) {
  const compiled = output.contracts[fileName][contractName]
  const bytecode = compiled.evm.bytecode.object
  if (!bytecode) throw new Error(`Compiler returned no bytecode for ${contractName}`)
  return {
    contractName,
    abi: compiled.abi,
    bytecode: `0x${bytecode}`,
  }
}

const outDir = resolve(root, '../pulse-app/src/contracts')
writeFileSync(resolve(outDir, 'FixedSupplyToken.json'), `${JSON.stringify(artifact('FixedSupplyToken.sol', 'FixedSupplyToken'), null, 2)}\n`)
writeFileSync(resolve(outDir, 'NexoriaTokenFactory.json'), `${JSON.stringify(artifact('NexoriaTokenFactory.sol', 'NexoriaTokenFactory'), null, 2)}\n`)
console.log('Wrote token and factory artifacts.')
