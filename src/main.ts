import { boostNamFileText, type BoostReport } from "./namBooster.js"

const fileInput = document.querySelector<HTMLInputElement>("#file-input")!
const dbInput = document.querySelector<HTMLInputElement>("#db-input")!
const boostBtn = document.querySelector<HTMLButtonElement>("#boost-btn")!
const fileList = document.querySelector<HTMLUListElement>("#file-list")!
const log = document.querySelector<HTMLPreElement>("#log")!

let selectedFiles: File[] = []

fileInput.addEventListener("change", () => {
  selectedFiles = Array.from(fileInput.files ?? []).filter((f) => f.name.toLowerCase().endsWith(".nam"))
  fileList.innerHTML = ""
  for (const file of selectedFiles) {
    const li = document.createElement("li")
    li.textContent = file.name
    fileList.appendChild(li)
  }
  boostBtn.disabled = selectedFiles.length === 0
})

function appendLog(text: string): void {
  log.textContent += text + "\n"
  log.scrollTop = log.scrollHeight
}

function describeReports(reports: BoostReport[]): string {
  return reports
    .map((r) => `  ${r.path} [${r.architecture}] via ${r.strategy}${r.outputWeightCount ? ` (${r.outputWeightCount} weights)` : ""}`)
    .join("\n")
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function boostedFilename(originalName: string, boostDb: number): string {
  const dot = originalName.lastIndexOf(".")
  const base = dot === -1 ? originalName : originalName.slice(0, dot)
  const ext = dot === -1 ? "" : originalName.slice(dot)
  const sign = boostDb >= 0 ? "+" : ""
  return `${base}_${sign}${boostDb.toFixed(0)}dB${ext}`
}

boostBtn.addEventListener("click", async () => {
  const boostDb = Number(dbInput.value)
  if (!Number.isFinite(boostDb)) {
    appendLog("Invalid dB value.")
    return
  }

  log.textContent = ""
  boostBtn.disabled = true

  for (const file of selectedFiles) {
    appendLog(`Processing ${file.name}...`)
    try {
      const text = await file.text()
      const { text: boostedText, reports } = boostNamFileText(text, boostDb)
      appendLog(describeReports(reports))
      const outName = boostedFilename(file.name, boostDb)
      downloadText(boostedText, outName)
      appendLog(`Saved: ${outName}\n`)
    } catch (err) {
      appendLog(`Failed: ${err instanceof Error ? err.message : String(err)}\n`)
    }
  }

  boostBtn.disabled = false
})
