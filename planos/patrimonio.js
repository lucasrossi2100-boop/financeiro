// ═══════════════════════════════════════════════════════════════════════════
// PLANO PATRIMÔNIO — inteligência financeira
// Este arquivo reúne tudo que é exclusivo do plano Patrimônio.
// Depende de funções globais já definidas no index.html: pd(), curMes(), fmtR()
// ═══════════════════════════════════════════════════════════════════════════

// ─── SCORE DE SAÚDE FINANCEIRA ───────────────────────────────────────────────
function calcularScoreSaude(){
  const lancs = pd().lancs || [];
  const invs  = pd().invs  || [];
  const hoje  = new Date();

  // Sem nenhum lançamento ainda — não faz sentido calcular nada, e muito
  // menos dar pontuação de brinde. Mostra estado "sem dados" de verdade.
  if(lancs.length === 0){
    return { score:null, nivel:'Sem dados', cor:'#666', semDados:true, fatores:[] };
  }

  // Últimos 6 meses (incluindo o atual)
  const meses = [];
  for(let i=5;i>=0;i--){
    const dt = new Date(hoje.getFullYear(), hoje.getMonth()-i, 1);
    meses.push(dt.toISOString().slice(0,7));
  }
  const porMes = meses.map(m=>{
    const doMes = lancs.filter(l=>l.data && l.data.startsWith(m));
    const rec = doMes.filter(l=>l.tipo==='receita').reduce((a,b)=>a+b.val,0);
    const des = doMes.filter(l=>l.tipo==='despesa').reduce((a,b)=>a+b.val,0);
    return {mes:m, receita:rec, despesa:des};
  });
  const atual = porMes[porMes.length-1];
  const totalInv = invs.reduce((a,b)=>a+b.val,0);

  // 1) Taxa de poupança este mês (peso 30) — só pontua se teve receita registrada de verdade
  const taxaPoupanca = atual.receita>0 ? (atual.receita-atual.despesa)/atual.receita : null;
  let pPoupanca = 0;
  if(taxaPoupanca!==null){
    if(taxaPoupanca>=0.3) pPoupanca=30;
    else if(taxaPoupanca>=0.2) pPoupanca=25;
    else if(taxaPoupanca>=0.1) pPoupanca=18;
    else if(taxaPoupanca>=0) pPoupanca=10;
  }

  // 2) Reserva de emergência: patrimônio investido ÷ média de despesas mensais (peso 25)
  const despesasValidas = porMes.map(m=>m.despesa).filter(v=>v>0);
  const mediaDespesa = despesasValidas.length ? despesasValidas.reduce((a,b)=>a+b,0)/despesasValidas.length : 0;
  const mesesReserva = mediaDespesa>0 ? totalInv/mediaDespesa : 0;
  let pReserva = 0; // sem despesas registradas ainda, não dá pra medir reserva — fica em 0, não em 3
  if(despesasValidas.length>0){
    pReserva = 3;
    if(mesesReserva>=6) pReserva=25;
    else if(mesesReserva>=3) pReserva=18;
    else if(mesesReserva>=1) pReserva=10;
  }

  // 3) Estabilidade de gastos: quão previsíveis são as despesas mês a mês (peso 20)
  let pEstabilidade = 0; // sem dados suficientes ainda — não dá crédito neutro por padrão
  if(despesasValidas.length>=3){
    const media = despesasValidas.reduce((a,b)=>a+b,0)/despesasValidas.length;
    const variancia = despesasValidas.reduce((a,b)=>a+Math.pow(b-media,2),0)/despesasValidas.length;
    const coefVar = media>0 ? Math.sqrt(variancia)/media : 1;
    if(coefVar<=0.15) pEstabilidade=20;
    else if(coefVar<=0.3) pEstabilidade=14;
    else if(coefVar<=0.5) pEstabilidade=8;
    else pEstabilidade=3;
  } else if(despesasValidas.length>0){
    pEstabilidade=5; // tem algum dado, mas pouco pra confiar — parcial, não neutro
  }

  // 4) Hábito de investir (peso 15)
  let pInvestimento = 0;
  if(totalInv>0 && invs.length>=3) pInvestimento=15;
  else if(totalInv>0) pInvestimento=10;

  // 5) Consistência de registro este mês (peso 10)
  const diasComLanc = new Set(lancs.filter(l=>l.data && l.data.startsWith(curMes())).map(l=>l.data)).size;
  const diasDoMes = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate();
  const pConsistencia = Math.min(10, Math.round((diasComLanc/diasDoMes)*10));

  const score = pPoupanca+pReserva+pEstabilidade+pInvestimento+pConsistencia;

  let nivel, cor;
  if(score>=80){nivel='Excelente';cor='#4ade80';}
  else if(score>=60){nivel='Bom';cor='#8ac97e';}
  else if(score>=40){nivel='Regular';cor='#fbbf24';}
  else if(score>=20){nivel='Atenção';cor='#f97316';}
  else {nivel='Crítico';cor='#f87171';}

  return {
    score, nivel, cor, semDados:false,
    fatores: [
      {label:'Taxa de poupança',        pontos:pPoupanca,      max:30, valor:taxaPoupanca!==null?`${(taxaPoupanca*100).toFixed(1)}%`:'sem receita este mês', desc:'Quanto sobra da renda depois das despesas'},
      {label:'Reserva de emergência',   pontos:pReserva,       max:25, valor:despesasValidas.length>0?`${mesesReserva.toFixed(1)} meses`:'sem despesas registradas', desc:'Quantos meses de despesas seu patrimônio cobre'},
      {label:'Estabilidade de gastos',  pontos:pEstabilidade,  max:20, valor:despesasValidas.length>=3?`${(porMes.length)} meses analisados`:'poucos dados ainda', desc:'Quão previsíveis são seus gastos mês a mês'},
      {label:'Hábito de investir',      pontos:pInvestimento,  max:15, valor:fmtR(totalInv),                              desc:'Se você investe com regularidade'},
      {label:'Consistência de registro',pontos:pConsistencia,  max:10, valor:`${diasComLanc} dias este mês`,              desc:'Quantos dias você registrou lançamentos'},
    ]
  };
}

function renderScore(){
  try{
    const el = document.getElementById('score-content');
    if(!el) return;
    const r = calcularScoreSaude();

    if(r.semDados){
      el.innerHTML = `
        <div class="card card-full" style="text-align:center;padding:48px 20px">
          <div style="font-size:38px;margin-bottom:12px">💎</div>
          <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px">Ainda não temos dados suficientes</div>
          <div style="font-size:13px;color:var(--muted);max-width:340px;margin:0 auto">Registre suas receitas e despesas do mês pra começar a calcular seu Score de Saúde Financeira.</div>
        </div>`;
      return;
    }

    const raio = 54, circ = 2*Math.PI*raio;
    const offset = circ - (r.score/100)*circ;

    el.innerHTML = `
      <div class="card card-full" style="margin-bottom:16px;text-align:center;padding:32px 20px">
        <div style="position:relative;width:160px;height:160px;margin:0 auto 16px">
          <svg width="160" height="160" viewBox="0 0 120 120" style="transform:rotate(-90deg)">
            <circle cx="60" cy="60" r="${raio}" fill="none" stroke="var(--surface3)" stroke-width="10"/>
            <circle cx="60" cy="60" r="${raio}" fill="none" stroke="${r.cor}" stroke-width="10" stroke-linecap="round"
              stroke-dasharray="${circ}" stroke-dashoffset="${offset}" style="transition:stroke-dashoffset 1s ease"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div style="font-size:38px;font-weight:700;color:${r.cor};line-height:1">${r.score}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">de 100</div>
          </div>
        </div>
        <div style="font-size:19px;font-weight:600;color:${r.cor}">${r.nivel}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Sua saúde financeira está ${r.nivel.toLowerCase()} este mês</div>
      </div>

      <div class="card card-full">
        <h3><span class="dot" style="background:var(--accent)"></span>O que compõe seu score</h3>
        <div style="display:flex;flex-direction:column;gap:16px;margin-top:16px">
          ${r.fatores.map(f=>`
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:13px;font-weight:500">${f.label}</span>
                <span style="font-size:12px;color:var(--muted)">${f.pontos}/${f.max} pts</span>
              </div>
              <div style="background:var(--surface3);border-radius:4px;height:6px;overflow:hidden">
                <div style="width:${(f.pontos/f.max*100).toFixed(0)}%;height:100%;background:var(--accent);border-radius:4px;transition:width .6s ease"></div>
              </div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px">${f.desc} · ${f.valor}</div>
            </div>`).join('')}
        </div>
      </div>`;
  }catch(e){console.error('renderScore error:',e);}
}

// ─── Próximas funcionalidades do Patrimônio entram aqui, uma de cada vez: ───
// 2) Insights automáticos
// 3) Projeções futuras
// 4) Evolução patrimonial
// 5) Planejamento para liberdade financeira
// 6) Recomendações inteligentes
