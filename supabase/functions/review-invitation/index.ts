Deno.serve(() => new Response(JSON.stringify({error:'Review invitations are no longer available'}), {status:410, headers:{'Content-Type':'application/json'}}));
