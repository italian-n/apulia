// GET /api/admin — static admin page; all data comes from /api/admin-payment
// with the token typed in by the owner (kept in sessionStorage only).
const PAGE = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Platby – admin</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;background:#0f1a14;color:#eee}
input,button{font:inherit;padding:10px;border-radius:8px;border:1px solid #555;background:#1b2a21;color:#eee}button{cursor:pointer;background:#c9a24b;color:#111;border:0}
.row{display:flex;gap:8px;margin:8px 0}.row input{flex:1}.card{background:#1b2a21;border-radius:10px;padding:14px;margin:12px 0}
.ok{color:#6fd18b}.bad{color:#ff8a80}.mut{color:#9aa}table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}td:first-child{color:#9aa;width:35%}</style></head><body>
<h1>Platby</h1>
<div class="row"><input id="tok" type="password" placeholder="Admin token" autocomplete="off"></div>
<div class="row"><input id="pid" inputmode="numeric" placeholder="GoPay ID platby (např. 3000123456)"><button id="go">Najít</button></div>
<p class="mut">Seznam všech plateb a výplaty: <a style="color:#c9a24b" href="https://gate.gopay.cz/" target="_blank" rel="noopener noreferrer">GoPay administrace</a>.</p>
<div id="out"></div><div id="recent" class="mut"></div>
<script>
const $=id=>document.getElementById(id), T=$('tok');
try{T.value=sessionStorage.getItem('t')||''}catch(e){}
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kc=n=>Number(n).toLocaleString('cs-CZ')+' Kč';
let recent=[];try{recent=JSON.parse(sessionStorage.getItem('r')||'[]')}catch(e){}
function drawRecent(){$('recent').innerHTML=recent.length?'Naposledy: '+recent.map(i=>'<a href="#" data-id="'+esc(i)+'" style="color:#c9a24b">'+esc(i)+'</a>').join(' · '):''}
async function find(id){
  $('out').textContent='…';
  try{sessionStorage.setItem('t',T.value)}catch(e){}
  const r=await fetch('/api/admin-payment?id='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+T.value}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){$('out').innerHTML='<div class="card bad">'+esc(d.error||r.status)+'</div>';return}
  recent=[id,...recent.filter(x=>x!==id)].slice(0,8);try{sessionStorage.setItem('r',JSON.stringify(recent))}catch(e){}drawRecent();
  const paid=d.state==='PAID';
  $('out').innerHTML='<div class="card"><h2 class="'+(paid?'ok':'bad')+'">'+esc(d.state)+(d.sub_state?' / '+esc(d.sub_state):'')+'</h2><table>'+
   [['Objednávka',d.order_number],['Částka',kc(d.amount)+' '+esc(d.currency)],['Platba',d.method==='bank'?'Online převod':'Karta'],
    ['Zákazník',d.customer.name],['E-mail',d.customer.email],['Telefon',d.customer.phone],['Adresa',d.address],
    ['Zboží',d.items.map(i=>esc(i.name)+' ×'+i.qty+' — '+kc(i.sum)).join('<br>')||'—'],
    ['Doprava',d.delivery?esc(d.delivery.name)+' ('+kc(d.delivery.price)+')':'—']]
   .map(([k,v])=>'<tr><td>'+k+'</td><td>'+(k==='Zboží'?v:esc(v||'—'))+'</td></tr>').join('')+'</table></div>';
}
$('go').onclick=()=>{const v=$('pid').value.trim();if(/^\\d{1,20}$/.test(v))find(v);else $('out').innerHTML='<div class="card bad">Neplatné ID</div>'};
$('recent').onclick=e=>{const a=e.target.closest('a');if(a){e.preventDefault();$('pid').value=a.dataset.id;find(a.dataset.id)}};
drawRecent();
</script></body></html>`;

module.exports = (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.status(200).send(PAGE);
};
