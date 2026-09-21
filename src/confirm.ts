export function confirmDelete(what: string): boolean {
  return window.confirm(`Delete ${what}? This can't be undone.`)
}