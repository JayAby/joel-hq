import { ConflictError, type Db, type DocMeta, type Edit } from '../src/firestore'

export class FakeDb implements Db {
  docs = new Map<string, DocMeta>()
  clock = 1
  getDoc = async (path: string) => {
    const d = this.docs.get(path)
    return d ? { data: structuredClone(d.data), updateTime: d.updateTime } : null
  }
  update = async (path: string, edits: Edit[], opts?: { ifUpdateTime?: string }) => {
    const cur = this.docs.get(path)
    if (opts?.ifUpdateTime && (!cur || cur.updateTime !== opts.ifUpdateTime)) throw new ConflictError('changed')
    const data = cur ? cur.data : {}
    for (const e of edits) {
      let o = data as Record<string, unknown>
      for (let i = 0; i < e.path.length - 1; i++) {
        if (typeof o[e.path[i]] !== 'object' || o[e.path[i]] === null) o[e.path[i]] = {}
        o = o[e.path[i]] as Record<string, unknown>
      }
      o[e.path[e.path.length - 1]] = structuredClone(e.value)
    }
    this.docs.set(path, { data, updateTime: `t${this.clock++}` })
  }
  set = async (path: string, data: Record<string, unknown>) =>
    this.update(path, Object.entries(data).map(([k, v]) => ({ path: [k], value: v })))
  remove = async (path: string) => void this.docs.delete(path)
  list = async (c: string) =>
    [...this.docs.entries()]
      .filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/'))
      .map(([k, v]) => ({ id: k.split('/').pop() as string, data: v.data }))
}
