export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, marker: 'ping-v1' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
