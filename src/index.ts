import { parse } from 'node:path'
import { Hover, MarkdownString, languages, workspace } from 'vscode'
import type { ExtensionContext, Uri } from 'vscode'
import ParseContext from './ParseContext'

export async function activate(context: ExtensionContext) {
  // 读取配置文件 获取项目编码 & 资源位编码
  const dir: string = await workspace.findFiles('package.json').then((files) => {
    if (!files.length)
      return ''
    const { dir } = parse(files[0].path)
    return dir
  })
  const parseCtx = new ParseContext(dir)

  // 根据项目编码，资源位编码，生成 可选择的链接
  context.subscriptions.push(languages.registerHoverProvider('*', {
    provideHover(document, position) {
      const range = document.getWordRangeAtPosition(position)
      const word = document.getText(range)

      if (parseCtx.config[word]) {
        const contents = new MarkdownString(parseCtx.formatConfigInfo(word))
        contents.isTrusted = true
        return new Hover(contents, range)
      }
    },
  }))

  function updateWithScan(files: readonly Uri[], reScan: boolean = true) {
    const needScan = files.some((file) => {
      const { name, ext } = parse(file.path)
      return parseCtx.fileNameMap[`${name}${ext}`] || `${name}${ext}` === 'settings.json'
    })
    if (!needScan)
      return

    if (reScan)
      parseCtx.configFiles = parseCtx.scan(parseCtx.base)
    files.forEach((file) => {
      const { name, ext } = parse(file.path)
      if (parseCtx.fileNameMap[`${name}${ext}`] || `${name}${ext}` === 'settings.json')
        parseCtx.update()
    })
  }

  context.subscriptions.push(
    workspace.onDidChangeTextDocument((e) => {
      updateWithScan([e.document.uri], false)
    }),
    workspace.onDidCreateFiles((e) => {
      updateWithScan(e.files)
    }),
    workspace.onDidDeleteFiles((e) => {
      updateWithScan(e.files)
    }),
  )

  // 用户点击链接跳转
}

export function deactivate() {

}
