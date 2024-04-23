import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import ignore from 'ignore'
import { Uri, workspace } from 'vscode'
import type { DotenvParseOutput } from 'dotenv'
import type { TextDocument } from 'vscode'
import type { Ignore } from 'ignore'

export interface ConfigMap {
  [name: string]: {
    [key: string]: string
  }
}

const defaultEnvs: string[] = ['', 'development', 'dev', 'prepare', 'production']

export function getConfiguredProperty<T>(
  document: TextDocument | null,
  property: string,
  fallback: T,
): T {
  const config = workspace.getConfiguration('dotpreview', document ? document.uri : undefined)
  return config.get(property.toLowerCase(), config.get(property, fallback))
}

export default class ParseContext {
  base: string
  configFiles: string[]
  ignore: Ignore
  config: ConfigMap
  fileNameMap: Record<string, boolean>
  constructor(base: string) {
    this.base = base
    this.config = {}
    this.fileNameMap = this.getFileNameMap()
    this.ignore = this.getIgnores(base)
    this.configFiles = this.scan(base)
    this.parse()
  }

  getIgnores(base: string) {
    const path = join(base, '.gitignore')
    if (!existsSync(path))
      return ignore().add(['node_modules', 'dist'])

    return ignore().add(readFileSync(path).toString())
  }

  getPluginConfig() {
    const prefixs = [...new Set([...getConfiguredProperty(null, 'prefix', []), '.env'])]
    const envs = [...new Set([...getConfiguredProperty(null, 'env', []), ...defaultEnvs])]
    const scanExclude: string[] = [...new Set([...getConfiguredProperty(null, 'scanExclude', []), ...['.git']])]
    return {
      envs,
      prefixs,
      scanExclude,
    }
  }

  getFileNameMap() {
    const { prefixs, envs } = this.getPluginConfig()
    const fileNameMap: Record<string, boolean> = {}
    prefixs.forEach((prefix) => {
      envs.forEach((env) => {
        fileNameMap[env ? `${prefix}.${env}` : prefix] = true
      })
    })
    return fileNameMap
  }

  scan(base: string): string[] {
    const { scanExclude } = this.getPluginConfig()
    const files = readdirSync(base)
    const result = []
    for (const file of files) {
      if (scanExclude.includes(file))
        continue
      const curDir = join(base, file)
      if (this.ignore.ignores(relative(this.base, curDir)))
        continue
      if (statSync(curDir).isDirectory())
        result.push(...this.scan(curDir))
      else if (this.fileNameMap[file])
        result.push(curDir)
    }
    return result
  }

  load(path: string): DotenvParseOutput {
    if (!existsSync(path))
      return {}
    const env = expand(config({ processEnv: {}, path }))
    return env.parsed || {}
  }

  convertConfig(parsedConfig: Record<string, DotenvParseOutput>) {
    const keys = Object.keys(parsedConfig)
    const configMap: ConfigMap = {}

    keys.forEach((key) => {
      const config = parsedConfig[key]
      Object.keys(config).forEach((targetKey) => {
        configMap[targetKey] = {
          ...configMap[targetKey],
          [key]: config[targetKey],
        }
      })
    })

    return configMap
  }

  formatConfigInfo(key: string) {
    const curConfig = this.config[key]
    let result = ''
    Object.entries(curConfig).forEach(([key, value]) => {
      const link = Uri.parse(
        `command:vscode.open?${encodeURIComponent(JSON.stringify([Uri.file(join(this.base, key))]))}`,
      )
      result += `\r\n [${key}](${link} "${key}"): ${value} \n`
    })

    return result
  }

  parse() {
    if (!this.configFiles.length)
      this.config = {}

    const parsedConfig: Record<string, DotenvParseOutput> = {}
    this.configFiles.forEach((configFile) => {
      const relativePath = relative(this.base, configFile)
      parsedConfig[relativePath] = this.load(configFile)
    })
    this.config = this.convertConfig(parsedConfig)
  }

  update() {
    this.parse()
  }

  clean() {
    this.config = {}
    this.configFiles = []
  }
}
