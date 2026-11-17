import { Client } from "eve/client"

const client = new Client({
  baseUrl: process.argv[2] ?? "http://localhost:3000",
})
const health = await client.health()
console.log(`Agent: ${health.status}`)
