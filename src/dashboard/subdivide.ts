import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

// The skeleton's long bones are low-poly (a forearm is 400 triangles), so they read as faceted
// tubes. Loop subdivision rounds them off; smooth normals do the rest. This is a plain
// indexed implementation, linear in the number of edges, so the whole skeleton takes well
// under a second in the browser.

/** One Loop subdivision step on an indexed triangle mesh (positions only). */
export function loopSubdivide(positions: Float32Array, index: Uint32Array): { positions: Float32Array; index: Uint32Array } {
  const nv = positions.length / 3
  const nt = index.length / 3

  // Edges: key = lo * nv + hi. Each edge gets a new vertex and remembers its opposite corners.
  const edgeId = new Map<number, number>()
  const edgeA: number[] = []
  const edgeB: number[] = []
  const opp1: number[] = []
  const opp2: number[] = []
  const faces: number[] = [] // count of faces per edge
  const triEdges = new Uint32Array(nt * 3)

  for (let t = 0; t < nt; t++) {
    for (let k = 0; k < 3; k++) {
      const a = index[t * 3 + k]
      const b = index[t * 3 + ((k + 1) % 3)]
      const c = index[t * 3 + ((k + 2) % 3)]
      const lo = a < b ? a : b
      const hi = a < b ? b : a
      const key = lo * nv + hi
      let e = edgeId.get(key)
      if (e === undefined) {
        e = edgeA.length
        edgeId.set(key, e)
        edgeA.push(lo)
        edgeB.push(hi)
        opp1.push(c)
        opp2.push(-1)
        faces.push(1)
      } else {
        if (faces[e] === 1) opp2[e] = c
        faces[e]++
      }
      triEdges[t * 3 + k] = e
    }
  }

  const ne = edgeA.length
  const out = new Float32Array((nv + ne) * 3)

  // Original vertices: Loop weights for interior vertices; boundary (or non-manifold) vertices
  // follow only their boundary neighbours so open edges keep their shape.
  const valence = new Uint32Array(nv)
  const sum = new Float64Array(nv * 3)
  const bCount = new Uint32Array(nv)
  const bSum = new Float64Array(nv * 3)
  for (let e = 0; e < ne; e++) {
    const a = edgeA[e]
    const b = edgeB[e]
    valence[a]++
    valence[b]++
    for (let d = 0; d < 3; d++) {
      sum[a * 3 + d] += positions[b * 3 + d]
      sum[b * 3 + d] += positions[a * 3 + d]
    }
    if (faces[e] !== 2) {
      bCount[a]++
      bCount[b]++
      for (let d = 0; d < 3; d++) {
        bSum[a * 3 + d] += positions[b * 3 + d]
        bSum[b * 3 + d] += positions[a * 3 + d]
      }
    }
  }
  for (let v = 0; v < nv; v++) {
    if (bCount[v] === 2) {
      for (let d = 0; d < 3; d++) out[v * 3 + d] = 0.75 * positions[v * 3 + d] + 0.125 * bSum[v * 3 + d]
    } else if (bCount[v] > 0 || valence[v] < 3) {
      for (let d = 0; d < 3; d++) out[v * 3 + d] = positions[v * 3 + d]
    } else {
      const k = valence[v]
      const beta = k === 3 ? 3 / 16 : 3 / (8 * k)
      for (let d = 0; d < 3; d++) out[v * 3 + d] = (1 - k * beta) * positions[v * 3 + d] + beta * sum[v * 3 + d]
    }
  }

  // Edge vertices.
  for (let e = 0; e < ne; e++) {
    const o = (nv + e) * 3
    const a = edgeA[e] * 3
    const b = edgeB[e] * 3
    if (faces[e] === 2) {
      const c = opp1[e] * 3
      const d2 = opp2[e] * 3
      for (let d = 0; d < 3; d++) out[o + d] = 0.375 * (positions[a + d] + positions[b + d]) + 0.125 * (positions[c + d] + positions[d2 + d])
    } else {
      for (let d = 0; d < 3; d++) out[o + d] = 0.5 * (positions[a + d] + positions[b + d])
    }
  }

  // Each triangle becomes four.
  const idx = new Uint32Array(nt * 12)
  for (let t = 0; t < nt; t++) {
    const a = index[t * 3]
    const b = index[t * 3 + 1]
    const c = index[t * 3 + 2]
    const ab = nv + triEdges[t * 3]
    const bc = nv + triEdges[t * 3 + 1]
    const ca = nv + triEdges[t * 3 + 2]
    idx.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], t * 12)
  }
  return { positions: out, index: idx }
}

/**
 * A bone mesh from the GLB, made ready to shade: dequantised into world space, welded,
 * subdivided (more for the coarsest bones), with smooth normals.
 */
export function prepareBone(mesh: THREE.Mesh): THREE.BufferGeometry {
  const src = mesh.geometry
  const pos = src.getAttribute('position')
  const flat = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    flat[i * 3] = pos.getX(i)
    flat[i * 3 + 1] = pos.getY(i)
    flat[i * 3 + 2] = pos.getZ(i)
  }
  let g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(flat, 3))
  if (src.index) g.setIndex(src.index.clone())
  g.applyMatrix4(mesh.matrixWorld)
  g = mergeVertices(g, 1e-6)

  let positions: Float32Array = Float32Array.from(g.getAttribute('position').array)
  let index: Uint32Array = Uint32Array.from(g.getIndex()!.array)
  const triangles = index.length / 3
  const passes = triangles < 1500 ? 2 : triangles < 12000 ? 1 : 0
  for (let i = 0; i < passes; i++) ({ positions, index } = loopSubdivide(positions, index))

  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  out.setIndex(new THREE.BufferAttribute(index, 1))
  out.computeVertexNormals()
  out.computeBoundingSphere()
  return out
}
