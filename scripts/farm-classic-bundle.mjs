import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeBundle } from '../store/ext-import.js'
import { farmClassicFiles } from './farm-classic-files.mjs'

const files = farmClassicFiles()
const version = JSON.parse(files['manifest.json']).version
const directory = process.argv[2] || 'dist'
mkdirSync(directory, { recursive: true })
const path = join(directory, `ext-farm-${version}.piggyext`)
writeFileSync(path, makeBundle(files))
console.log(path)
