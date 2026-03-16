import { Command } from 'commander'
import { createServer } from './server.js'
import open from 'open'

const program = new Command()

program
  .name('monkey-map')
  .description('FigJam-like mind map tool for any repo')
  .option('-p, --port <number>', 'server port', '3141')
  .option('-f, --file <path>', 'mindmap file path', '.monkeymap.json')
  .option('--no-open', 'skip opening browser')
  .action(async (opts) => {
    const port = parseInt(opts.port, 10)
    const file = opts.file as string

    const { url } = await createServer({ port, file })
    console.log(`Monkey Map running at ${url}`)

    if (opts.open !== false) {
      await open(url)
    }
  })

program.parse()
