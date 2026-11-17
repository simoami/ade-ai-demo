import assert from "node:assert/strict"
import { test } from "node:test"
import { validateEnvironment } from "../agent/lib/environment.ts"

test("accepts a Gateway key or Vercel OIDC token", () => {
  assert.doesNotThrow(() =>
    validateEnvironment({ AI_GATEWAY_API_KEY: "test-key" })
  )
  assert.doesNotThrow(() =>
    validateEnvironment({ VERCEL_OIDC_TOKEN: "test-token" })
  )
})

test("rejects missing and blank credentials without disclosing values", () => {
  for (const env of [
    {},
    { AI_GATEWAY_API_KEY: " " },
    { VERCEL_OIDC_TOKEN: "" },
  ]) {
    assert.throws(() => validateEnvironment(env), /Set AI_GATEWAY_API_KEY/)
  }
  assert.throws(
    () =>
      validateEnvironment({
        AI_GATEWAY_API_KEY: "secret",
        VERCEL_OIDC_TOKEN: "",
      }),
    (error: unknown) =>
      error instanceof Error && !error.message.includes("secret")
  )
})
