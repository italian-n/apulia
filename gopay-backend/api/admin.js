// GET /api/admin — static admin page; all data comes from /api/admin-payment
// with the token typed in by the owner (kept in sessionStorage only).
const PAGE = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Objednávky – admin</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:860px;margin:24px auto;padding:0 16px;background:#0f1a14;color:#eee}
input,select,button{font:inherit;padding:8px 10px;border-radius:8px;border:1px solid #555;background:#1b2a21;color:#eee}button{cursor:pointer;background:#c9a24b;color:#111;border:0}
.row{display:flex;gap:8px;margin:8px 0;flex-wrap:wrap}.row input{flex:1;min-width:140px}.card{background:#1b2a21;border-radius:10px;padding:14px;margin:12px 0}
.ok{color:#6fd18b}.bad{color:#ff8a80}.warn{color:#ffd37a}.mut{color:#9aa}.top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}td:first-child{color:#9aa;width:30%}h1{margin:0 0 8px}.tabs button{background:#1b2a21;color:#eee;border:1px solid #555}.tabs button.on{background:#c9a24b;color:#111}</style></head><body>
<h1>Objednávky</h1>
<div class="row"><input id="tok" type="password" placeholder="Admin token" autocomplete="off"><button id="load">Načíst</button></div>
<div class="row tabs" id="tabs"><button data-s="PAID" class="on">Zaplacené</button><button data-s="CREATED">Čekají na platbu</button><button data-s="">Vše</button></div>
<div id="list"></div>
<h2>Hledat platbu v GoPay</h2>
<div class="row"><input id="pid" inputmode="numeric" placeholder="ID platby GoPay"><button id="go">Najít</button></div>
<div id="out"></div>
<p class="mut">Výplaty a refundace: <a style="color:#c9a24b" href="https://gate.gopay.cz/" target="_blank" rel="noopener noreferrer">GoPay administrace</a>.</p>
<script>
const $=id=>document.getElementById(id),T=$('tok');let S='PAID',ORD=[];
try{T.value=sessionStorage.getItem('t')||''}catch(e){}
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kc=n=>Number(n).toLocaleString('cs-CZ')+' Kč';
const FUL={new:'Nová',packed:'Zabaleno',shipped:'Odesláno',delivered:'Doručeno',cancelled:'Zrušeno'};
const H=()=>({Authorization:'Bearer '+T.value,'Content-Type':'application/json'});
const stCls=s=>s==='PAID'?'ok':(s==='CREATED'?'warn':'bad');
async function load(){
  $('list').textContent='…';try{sessionStorage.setItem('t',T.value)}catch(e){}
  const r=await fetch('/api/admin-orders?limit=100'+(S?'&state='+S:''),{headers:H()});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){$('list').innerHTML='<div class="card bad">'+esc(d.error||r.status)+(d.detail?'<br><small class="mut">'+esc(d.detail)+'</small>':'')+'</div>';return}
  ORD=d.orders;draw();
}
function draw(){
  if(!ORD.length){$('list').innerHTML='<div class="card mut">Žádné objednávky.</div>';return}
  $('list').innerHTML=ORD.map(o=>'<div class="card" data-id="'+esc(o.payment_id)+'"><div class="top"><b>'+esc(o.order_number||o.payment_id)+'</b><span class="'+stCls(o.state)+'">'+esc(o.state)+' · '+kc(o.amount||0)+'</span></div>'+
  '<div class="mut">'+new Date(o.created_at).toLocaleString('cs-CZ')+' · '+(o.method==='bank'?'převod':'karta')+' · GoPay '+esc(o.payment_id)+'</div><table>'+
  '<tr><td>Zákazník</td><td>'+esc(o.customer_name)+' · <a style="color:#c9a24b" href="mailto:'+esc(o.email)+'">'+esc(o.email)+'</a> · '+esc(o.phone||'')+'</td></tr>'+
  '<tr><td>Adresa</td><td>'+esc(o.address||'—')+'</td></tr>'+
  '<tr><td>Zboží</td><td>'+(o.items||[]).map(i=>esc(i.name)+' ×'+Number(i.qty)+' — '+kc(i.sum)).join('<br>')+'</td></tr>'+
  '<tr><td>Doprava</td><td>'+esc(o.delivery||'—')+'</td></tr></table>'+
  '<div class="row"><select class="ful">'+Object.keys(FUL).map(k=>'<option value="'+k+'"'+(k===o.fulfillment?' selected':'')+'>'+FUL[k]+'</option>').join('')+'</select>'+
  '<input class="note" maxlength="500" placeholder="Poznámka (č. zásilky…)" value="'+esc(o.note||'')+'"><button class="save">Uložit</button></div></div>').join('');
}
$('list').onclick=async e=>{
  if(!e.target.classList.contains('save'))return;
  const c=e.target.closest('.card');e.target.textContent='…';
  const r=await fetch('/api/admin-orders',{method:'PATCH',headers:H(),body:JSON.stringify({id:c.dataset.id,fulfillment:c.querySelector('.ful').value,note:c.querySelector('.note').value})});
  e.target.textContent=r.ok?'Uloženo ✓':'Chyba';setTimeout(()=>e.target.textContent='Uložit',1500);
};
$('tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;S=b.dataset.s;[...$('tabs').children].forEach(x=>x.classList.toggle('on',x===b));load()};
$('load').onclick=load;
async function find(id){
  $('out').textContent='…';
  const r=await fetch('/api/admin-payment?id='+encodeURIComponent(id),{headers:H()});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){$('out').innerHTML='<div class="card bad">'+esc(d.error||r.status)+'</div>';return}
  $('out').innerHTML='<div class="card"><h3 class="'+stCls(d.state)+'">'+esc(d.state)+(d.sub_state?' / '+esc(d.sub_state):'')+'</h3>'+esc(d.order_number)+' · '+kc(d.amount)+' '+esc(d.currency)+'<br>'+esc(d.customer_name)+' · '+esc(d.email||'')+'<br>'+(d.items||[]).map(i=>esc(i.name)+' ×'+Number(i.qty)).join(', ')+
  '<div class="row"><button id="imp" data-id="'+esc(d.payment_id)+'">Přidat do seznamu objednávek</button></div></div>';
}
$('out').onclick=async e=>{
  if(e.target.id!=='imp')return;e.target.textContent='…';
  const r=await fetch('/api/admin-orders',{method:'POST',headers:H(),body:JSON.stringify({import:e.target.dataset.id})});
  e.target.textContent=r.ok?'Přidáno ✓':'Chyba';if(r.ok){S='';[...$('tabs').children].forEach(x=>x.classList.toggle('on',x.dataset.s===''));load()}
};
$('go').onclick=()=>{const v=$('pid').value.trim();if(/^\d{1,20}$/.test(v))find(v);else $('out').innerHTML='<div class="card bad">Neplatné ID</div>'};
if(T.value)load();
</script></body></html>`;

module.exports = (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.status(200).send(PAGE);
};
