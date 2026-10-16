// Offline test of Firebase login-token checking, with a throwaway key.
import assert from 'node:assert/strict'
import { verifyFirebaseIdToken, type Jwk } from '../src/auth'

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')

async function main() {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const pub = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as { n: string; e: string; kty: string }
  const jwk: Jwk = { kid: 'k1', kty: pub.kty, n: pub.n, e: pub.e, alg: 'RS256' }
  const loadKeys = async () => [jwk]
  const now = 1_800_000_000

  async function mint(over: Record<string, unknown> = {}, kid = 'k1', tamper = false) {
    const header = enc({ alg: 'RS256', kid, typ: 'JWT' })
    const payload = enc({
      aud: 'proj',
      iss: 'https://securetoken.google.com/proj',
      sub: 'uid1',
      iat: now - 10,
      exp: now + 3000,
      email: 'Joel@jo3lhq.local',
      ...over,
    })
    const sig = Buffer.from(
      await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${header}.${payload}`)),
    ).toString('base64url')
    return tamper ? `${header}.${enc({ aud: 'proj', iss: 'https://securetoken.google.com/proj', sub: 'x', iat: now, exp: now + 99, email: 'joel@jo3lhq.local' })}.${sig}` : `${header}.${payload}.${sig}`
  }

  const opts = { projectId: 'proj', allowedEmail: 'joel@jo3lhq.local', nowSeconds: now, loadKeys }

  assert.deepEqual(await verifyFirebaseIdToken(await mint(), opts), { ok: true, email: 'joel@jo3lhq.local' })
  const bad = async (t: string, reason: string) => {
    const r = await verifyFirebaseIdToken(t, opts)
    assert.equal(r.ok, false, reason)
    if (!r.ok) assert.ok(r.reason.includes(reason), `${reason} vs ${r.reason}`)
  }
  await bad(await mint({ email: 'someone@else.com' }), 'not allowed')
  await bad(await mint({ exp: now - 1 }), 'expired')
  await bad(await mint({ aud: 'other' }), 'audience')
  await bad(await mint({ iss: 'https://evil' }), 'issuer')
  await bad(await mint({ iat: now + 9999 }), 'future')
  await bad(await mint({}, 'unknown-kid'), 'unknown key')
  await bad(await mint({}, 'k1', true), 'signature')
  await bad('not.a.jwt', 'error')
  await bad('abc', 'malformed')
  console.log('AUTH TESTS PASSED')
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
