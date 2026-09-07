#!/usr/bin/env node

const path = require('path')
const { execute } = require('@oclif/core')

// In dev mode the commands are loaded straight from src/, so ts-node has to be registered
// before oclif resolves them.
require('ts-node').register({ project: path.join(__dirname, '..', 'tsconfig.json') })

execute({ development: true, dir: __dirname })
