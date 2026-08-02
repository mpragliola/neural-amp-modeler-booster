/**
 * Boosts the output level of a NAM (.nam) profile by scaling its final
 * output-layer weights, working across NAM's format generations:
 *
 *  - A1 (legacy WaveNet/LSTM): flat top-level `weights` array, output layer
 *    described by `config.layers[-1].channels` / `head_size` / `head_bias`.
 *  - A2 WaveNet: per-layer `head: { out_channels, kernel_size, bias }`, and
 *    usually a single scalar `config.head_scale` that IS the last weight —
 *    scaling that scalar is equivalent to scaling the whole output head.
 *  - A2 SlimmableContainer: no top-level `weights` at all — real models live
 *    at `config.submodels[].model`, each a self-contained architecture node
 *    (recursed the same way).
 *
 * Any model node is anything with its own `architecture` + `weights` array.
 * The walker finds every such node at any nesting depth, so future formats
 * that nest models differently still get picked up as long as they follow
 * that shape.
 */

export interface BoostReport {
  path: string
  architecture: string
  strategy: "head_scale" | "weights_tail" | "weights_tail_fallback"
  outputWeightCount?: number
  gain: number
}

export interface BoostResult {
  data: unknown
  reports: BoostReport[]
}

interface ModelNode {
  architecture?: unknown
  config?: Record<string, unknown>
  weights?: unknown
  [key: string]: unknown
}

function isModelNode(value: unknown): value is ModelNode {
  if (typeof value !== "object" || value === null) return false
  const node = value as ModelNode
  return typeof node.architecture === "string" && Array.isArray(node.weights) && node.weights.length > 0
}

function dbToLinearGain(boostDb: number): number {
  return 10 ** (boostDb / 20)
}

/** Output weight count for A2-style per-layer `head: {out_channels, kernel_size, bias}`. */
function countFromA2Head(head: Record<string, unknown>): number | undefined {
  const outChannels = head.out_channels
  const kernelSize = head.kernel_size
  if (typeof outChannels !== "number" || typeof kernelSize !== "number") return undefined
  const bias = head.bias === true ? 1 : 0
  return outChannels * kernelSize + bias
}

/** Output weight count for A1-style flat `channels` / `head_size` / `head_bias`. */
function countFromA1Layer(layer: Record<string, unknown>): number | undefined {
  const channels = layer.channels
  const headSize = layer.head_size
  if (typeof channels !== "number" || typeof headSize !== "number") return undefined
  const bias = layer.head_bias === true ? 1 : 0
  return channels * headSize + bias
}

const DEFAULT_OUTPUT_COUNT = 9

function resolveOutputWeightCount(config: Record<string, unknown> | undefined): number {
  const layers = config?.layers
  if (Array.isArray(layers) && layers.length > 0) {
    const lastLayer = layers[layers.length - 1] as Record<string, unknown>
    const head = lastLayer.head
    if (typeof head === "object" && head !== null) {
      const a2Count = countFromA2Head(head as Record<string, unknown>)
      if (a2Count !== undefined) return a2Count
    }
    const a1Count = countFromA1Layer(lastLayer)
    if (a1Count !== undefined) return a1Count
  }
  return DEFAULT_OUTPUT_COUNT
}

/** Scale one model node's output amplitude in place. Returns the report entry. */
function boostModelNode(node: ModelNode, gain: number, path: string): BoostReport {
  const architecture = typeof node.architecture === "string" ? node.architecture : "unknown"
  const weights = node.weights as number[]
  const config = node.config

  const headScale = config?.head_scale
  const lastWeight = weights[weights.length - 1]
  const headScaleMatchesLastWeight =
    typeof headScale === "number" && Math.abs(headScale - lastWeight) < 1e-6

  if (headScaleMatchesLastWeight) {
    weights[weights.length - 1] = lastWeight * gain
    ;(config as Record<string, unknown>).head_scale = (headScale as number) * gain
    return { path, architecture, strategy: "head_scale", gain }
  }

  const outputCount = resolveOutputWeightCount(config)
  const usedFallback = outputCount === DEFAULT_OUTPUT_COUNT && !config?.layers
  for (let i = weights.length - outputCount; i < weights.length; i++) {
    weights[i] = weights[i] * gain
  }
  return {
    path,
    architecture,
    strategy: usedFallback ? "weights_tail_fallback" : "weights_tail",
    outputWeightCount: outputCount,
    gain,
  }
}

/** Recursively find and boost every model node reachable from `value`. */
function walkAndBoost(value: unknown, gain: number, path: string, reports: BoostReport[]): void {
  if (isModelNode(value)) {
    reports.push(boostModelNode(value, gain, path))
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkAndBoost(item, gain, `${path}[${i}]`, reports))
    return
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if (key === "weights") continue
      walkAndBoost(child, gain, path ? `${path}.${key}` : key, reports)
    }
  }
}

/**
 * Boosts a parsed NAM profile (any generation) by `boostDb` decibels.
 * Mutates and returns `data` in place, plus a report of every model node touched.
 */
export function boostNamProfile(data: unknown, boostDb: number): BoostResult {
  const gain = dbToLinearGain(boostDb)
  const reports: BoostReport[] = []
  walkAndBoost(data, gain, "$", reports)
  if (reports.length === 0) {
    throw new Error("No model node with an 'architecture' and 'weights' array found in this file")
  }
  return { data, reports }
}

/** Convenience wrapper: parses, boosts, and re-serializes a raw .nam file's text content. */
export function boostNamFileText(fileContents: string, boostDb: number): { text: string; reports: BoostReport[] } {
  const parsed = JSON.parse(fileContents)
  const { data, reports } = boostNamProfile(parsed, boostDb)
  return { text: JSON.stringify(data), reports }
}
