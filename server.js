import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { extname, join } from "node:path"

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
}

const port = 8000
const root = process.cwd()

createServer(async (req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url
  const filePath = join(root, decodeURIComponent(urlPath.split("?")[0]))
  try {
    const data = await readFile(filePath)
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end("Not found")
  }
}).listen(port, () => console.log(`Serving http://localhost:${port}`))
