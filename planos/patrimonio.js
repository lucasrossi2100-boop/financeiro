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

// ─── INSIGHTS AUTOMÁTICOS ────────────────────────────────────────────────────
function gerarInsights(){
  const lancs = pd().lancs || [];
  const invs  = pd().invs  || [];
  const assinaturas = pd().assinaturas || [];
  const hoje  = new Date();
  const mesAtual = curMes();
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1).toISOString().slice(0,7);

  if(lancs.length === 0) return { semDados:true, insights:[] };

  const doMesAtual    = lancs.filter(l=>l.data && l.data.startsWith(mesAtual));
  const doMesAnterior = lancs.filter(l=>l.data && l.data.startsWith(mesAnterior));

  const recAtual = doMesAtual.filter(l=>l.tipo==='receita').reduce((a,b)=>a+b.val,0);
  const desAtual = doMesAtual.filter(l=>l.tipo==='despesa').reduce((a,b)=>a+b.val,0);
  const desAnt   = doMesAnterior.filter(l=>l.tipo==='despesa').reduce((a,b)=>a+b.val,0);

  const insights = [];

  // 1) Despesas em alta ou em queda vs mês anterior
  if(desAnt > 0 && desAtual > 0){
    const variacao = ((desAtual-desAnt)/desAnt)*100;
    if(variacao >= 20){
      insights.push({tipo:'atencao', icone:'⚠️', titulo:'Gastos em alta', texto:`Suas despesas subiram ${variacao.toFixed(0)}% em relação ao mês passado (${fmtR(desAnt)} → ${fmtR(desAtual)}).`});
    } else if(variacao <= -15){
      insights.push({tipo:'positivo', icone:'🎉', titulo:'Economia em alta', texto:`Você reduziu suas despesas em ${Math.abs(variacao).toFixed(0)}% em relação ao mês passado. Parabéns!`});
    }
  }

  // 2) Categoria que mais pesa no mês
  const porCategoria = {};
  doMesAtual.filter(l=>l.tipo==='despesa').forEach(l=>{ porCategoria[l.cat] = (porCategoria[l.cat]||0)+l.val; });
  const categorias = Object.entries(porCategoria).sort((a,b)=>b[1]-a[1]);
  if(categorias.length>0 && desAtual>0){
    const [maiorCat, maiorVal] = categorias[0];
    const pct = (maiorVal/desAtual)*100;
    if(pct>=30){
      insights.push({tipo:'neutro', icone:'📊', titulo:`${maiorCat} domina seus gastos`, texto:`${maiorCat} representa ${pct.toFixed(0)}% de tudo que você gastou este mês (${fmtR(maiorVal)}).`});
    }
  }

  // 3) Taxa de poupança do mês
  if(recAtual > 0){
    const taxa = ((recAtual-desAtual)/recAtual)*100;
    if(taxa < 0){
      insights.push({tipo:'atencao', icone:'🔴', titulo:'Gastando mais do que ganha', texto:`Este mês suas despesas (${fmtR(desAtual)}) já ultrapassaram sua receita (${fmtR(recAtual)}).`});
    } else if(taxa >= 30){
      insights.push({tipo:'positivo', icone:'💪', titulo:'Ótima taxa de poupança', texto:`Você está guardando ${taxa.toFixed(0)}% da sua renda este mês. Continue assim!`});
    }
  }

  // 4) Sem aporte novo este mês (só avisa se já tem histórico de investir)
  if(invs.length > 0){
    const investiuEsteMes = invs.some(i=>i.data && i.data.startsWith(mesAtual));
    if(!investiuEsteMes){
      insights.push({tipo:'neutro', icone:'💰', titulo:'Nenhum aporte este mês', texto:'Você ainda não registrou nenhum investimento novo este mês.'});
    }
  }

  // 5) Assinaturas pesando no orçamento
  const totalAssinaturas = assinaturas.reduce((a,b)=>a+(b.val||0),0);
  if(desAtual > 0 && totalAssinaturas > 0){
    const pctAssin = (totalAssinaturas/desAtual)*100;
    if(pctAssin >= 15){
      insights.push({tipo:'atencao', icone:'📱', titulo:'Assinaturas pesando no bolso', texto:`Suas assinaturas somam ${fmtR(totalAssinaturas)}/mês — ${pctAssin.toFixed(0)}% do seu gasto total.`});
    }
  }

  // 6) Poucos registros este mês (só depois do dia 10, pra não alarmar cedo demais)
  const diasComLanc = new Set(doMesAtual.map(l=>l.data)).size;
  if(hoje.getDate()>=10 && diasComLanc < hoje.getDate()*0.3){
    insights.push({tipo:'neutro', icone:'📝', titulo:'Poucos registros este mês', texto:`Você só lançou dados em ${diasComLanc} dias este mês. Registrar mais vezes deixa seus insights mais precisos.`});
  }

  if(insights.length===0){
    insights.push({tipo:'positivo', icone:'✅', titulo:'Tudo em ordem', texto:'Não identificamos nenhum ponto de atenção nas suas finanças este mês.'});
  }

  return { semDados:false, insights: insights.slice(0,4) }; // no máximo 4, pra não poluir a tela
}

function corInsight(tipo){
  if(tipo==='positivo') return '#4ade80';
  if(tipo==='atencao') return '#f97316';
  return 'var(--accent)';
}

// ─── DESAFIOS (gamificação) ──────────────────────────────────────────────────
function gerarDesafios(){
  const lancs = pd().lancs || [];
  const invs  = pd().invs  || [];
  const hoje  = new Date();
  const mesAtual = curMes();

  const doMesAtual = lancs.filter(l=>l.data && l.data.startsWith(mesAtual));
  const recAtual = doMesAtual.filter(l=>l.tipo==='receita').reduce((a,b)=>a+b.val,0);
  const desAtual = doMesAtual.filter(l=>l.tipo==='despesa').reduce((a,b)=>a+b.val,0);
  const diasComLanc = new Set(doMesAtual.map(l=>l.data)).size;
  const totalInv = invs.reduce((a,b)=>a+b.val,0);
  const mesesComInv = new Set(invs.filter(i=>i.data).map(i=>i.data.slice(0,7))).size;
  const s = calcularScoreSaude();

  // Reserva de emergência em meses (mesma lógica do Score)
  const meses = [];
  for(let i=5;i>=0;i--){
    const dt = new Date(hoje.getFullYear(), hoje.getMonth()-i, 1);
    meses.push(dt.toISOString().slice(0,7));
  }
  const despesasValidas = meses
    .map(m=>lancs.filter(l=>l.data && l.data.startsWith(m) && l.tipo==='despesa').reduce((a,b)=>a+b.val,0))
    .filter(v=>v>0);
  const mediaDespesa = despesasValidas.length ? despesasValidas.reduce((a,b)=>a+b,0)/despesasValidas.length : 0;
  const mesesReserva = mediaDespesa>0 ? totalInv/mediaDespesa : 0;

  return [
    {id:'primeiro-passo', icone:'🎯', titulo:'Primeiro Passo',        desc:'Registre seu primeiro lançamento',                     pontos:10, concluido: lancs.length>0},
    {id:'sequencia-7',    icone:'🔥', titulo:'Sequência de 7 dias',   desc:'Lance dados em 7 dias diferentes este mês',            pontos:30, concluido: diasComLanc>=7},
    {id:'guardiao-renda', icone:'🛡️', titulo:'Guardião da Renda',     desc:'Alcance 20% de taxa de poupança este mês',             pontos:25, concluido: recAtual>0 && ((recAtual-desAtual)/recAtual)>=0.2},
    {id:'primeiro-inv',   icone:'🌱', titulo:'Primeiro Investimento', desc:'Registre seu primeiro investimento',                   pontos:20, concluido: invs.length>0},
    {id:'invest-freq',    icone:'📈', titulo:'Investidor Frequente',  desc:'Invista em 3 meses diferentes',                        pontos:40, concluido: mesesComInv>=3},
    {id:'reserva',        icone:'🏦', titulo:'Reserva de Emergência', desc:'Acumule 3+ meses de despesas investidos',              pontos:50, concluido: mesesReserva>=3},
    {id:'mes-impecavel',  icone:'⭐', titulo:'Mês Impecável',         desc:'Alcance um Score de 80+ este mês',                     pontos:60, concluido: !s.semDados && s.score>=80},
    {id:'sem-estouro',    icone:'✅', titulo:'Sem Estouro no Orçamento', desc:'Não gaste mais do que ganhou este mês',              pontos:15, concluido: recAtual>0 && desAtual<=recAtual},
  ];
}

function calcularNivel(pontos){
  if(pontos>=500) return {nome:'Diamante', icone:'💎', cor:'#60a5fa'};
  if(pontos>=300) return {nome:'Ouro',     icone:'🥇', cor:'#fbbf24'};
  if(pontos>=150) return {nome:'Prata',    icone:'🥈', cor:'#cbd5e1'};
  if(pontos>=50)  return {nome:'Bronze',   icone:'🥉', cor:'#d97706'};
  return                 {nome:'Iniciante',icone:'🌱', cor:'#4ade80'};
}

// ─── RENDERIZAÇÃO DAS ABAS ────────────────────────────────────────────────────
let _patrimonioTab = 'score';

function trocarAbaPatrimonio(tab){
  _patrimonioTab = tab;
  renderScore();
}

function renderScoreTabHTML(){
  const r = calcularScoreSaude();

  if(r.semDados){
    return `
      <div class="card card-full" style="text-align:center;padding:48px 20px">
        <div style="font-size:38px;margin-bottom:12px">💎</div>
        <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px">Ainda não temos dados suficientes</div>
        <div style="font-size:13px;color:var(--muted);max-width:340px;margin:0 auto">Registre suas receitas e despesas do mês pra começar a calcular seu Score de Saúde Financeira.</div>
      </div>`;
  }

  const raio = 54, circ = 2*Math.PI*raio;
  const offset = circ - (r.score/100)*circ;

  return `
    <div class="card card-full" style="margin-bottom:16px;text-align:center;padding:32px 20px">
      <div style="position:relative;width:160px;height:160px;margin:0 auto 16px">
        <svg width="160" height="160" viewBox="0 0 120 120" style="transform:rotate(-90deg)">
          <circle cx="60" cy="60" r="${raio}" fill="none" stroke="var(--surface3)" stroke-width="10"/>
          <circle cx="60" cy="60" r="${raio}" fill="none" stroke="${r.cor}" stroke-width="10" stroke-linecap="round"
            stroke-dasharray="${circ}" stroke-dashoffset="${offset}" style="transition:stroke-dashoffset .6s ease"/>
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
}

function renderInsightsTabHTML(){
  const r = gerarInsights();
  if(r.semDados || !r.insights.length){
    return `
      <div class="card card-full" style="text-align:center;padding:48px 20px">
        <div style="font-size:38px;margin-bottom:12px">💡</div>
        <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px">Sem insights ainda</div>
        <div style="font-size:13px;color:var(--muted);max-width:340px;margin:0 auto">Registre alguns lançamentos pra começarmos a analisar seus dados.</div>
      </div>`;
  }
  return `
    <div class="card card-full">
      <h3><span class="dot" style="background:var(--accent)"></span>Insights automáticos</h3>
      <div style="display:flex;flex-direction:column;gap:2px;margin-top:12px">
        ${r.insights.map(i=>`
          <div style="display:flex;gap:10px;padding:12px 0;border-bottom:1px solid var(--border)">
            <div style="font-size:18px;flex-shrink:0">${i.icone}</div>
            <div style="min-width:0">
              <div style="font-size:13px;font-weight:600;color:${corInsight(i.tipo)}">${i.titulo}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;line-height:1.4">${i.texto}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderDesafiosTabHTML(){
  const desafios = gerarDesafios();
  const pontosGanhos = desafios.filter(d=>d.concluido).reduce((a,b)=>a+b.pontos,0);
  const pontosTotais = desafios.reduce((a,b)=>a+b.pontos,0);
  const nivel = calcularNivel(pontosGanhos);
  const concluidos = desafios.filter(d=>d.concluido).length;

  return `
    <div class="card card-full" style="margin-bottom:16px;text-align:center;padding:24px 20px">
      <div style="font-size:32px;margin-bottom:6px">${nivel.icone}</div>
      <div style="font-size:26px;font-weight:700;color:${nivel.cor}">${pontosGanhos} pts</div>
      <div style="font-size:13px;color:var(--muted);margin-top:2px">Nível ${nivel.nome} · ${concluidos}/${desafios.length} desafios concluídos</div>
      <div style="background:var(--surface3);border-radius:4px;height:6px;overflow:hidden;margin-top:14px">
        <div style="width:${pontosTotais>0?(pontosGanhos/pontosTotais*100).toFixed(0):0}%;height:100%;background:${nivel.cor};border-radius:4px;transition:width .6s ease"></div>
      </div>
    </div>

    <div class="card card-full">
      <h3><span class="dot" style="background:var(--accent)"></span>Desafios</h3>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
        ${desafios.map(d=>`
          <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--surface2);border-radius:10px;opacity:${d.concluido?'1':'.65'}">
            <div style="font-size:20px;flex-shrink:0">${d.concluido?'✅':d.icone}</div>
            <div style="min-width:0;flex:1">
              <div style="font-size:13px;font-weight:600;color:${d.concluido?'var(--text)':'var(--muted)'}">${d.titulo}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${d.desc}</div>
            </div>
            <div style="font-size:12px;font-weight:700;color:${d.concluido?'#4ade80':'var(--muted)'};flex-shrink:0">+${d.pontos}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ─── PROJEÇÕES FUTURAS ────────────────────────────────────────────────────────
let _projecaoTaxa = 0.8; // % ao mês — mesmo padrão usado na Renda Passiva (CDI)

function atualizarProjecaoTaxa(valor){
  _projecaoTaxa = parseFloat(valor) || 0;
  renderScore();
}

function calcularProjecoes(){
  const lancs = pd().lancs || [];
  const invs  = pd().invs  || [];
  const hoje  = new Date();

  if(lancs.length === 0) return { semDados:true };

  const meses = [];
  for(let i=5;i>=0;i--){
    const dt = new Date(hoje.getFullYear(), hoje.getMonth()-i, 1);
    meses.push(dt.toISOString().slice(0,7));
  }
  const saldosMensais = meses.map(m=>{
    const doMes = lancs.filter(l=>l.data && l.data.startsWith(m));
    const rec = doMes.filter(l=>l.tipo==='receita').reduce((a,b)=>a+b.val,0);
    const des = doMes.filter(l=>l.tipo==='despesa').reduce((a,b)=>a+b.val,0);
    return rec-des;
  });
  const mediaPoupanca = saldosMensais.reduce((a,b)=>a+b,0) / saldosMensais.length;
  const patrimonioAtual = invs.reduce((a,b)=>a+b.val,0);
  const taxa = _projecaoTaxa/100;
  const aporteMensal = Math.max(0, mediaPoupanca); // nunca projeta aporte negativo

  const trajetoria = [patrimonioAtual];
  let valor = patrimonioAtual;
  for(let i=1;i<=60;i++){
    valor = valor*(1+taxa) + aporteMensal;
    trajetoria.push(valor);
  }

  return {
    semDados:false,
    patrimonioAtual, mediaPoupanca, aporteMensal, taxa:_projecaoTaxa, trajetoria,
    marcos: [
      {label:'Em 6 meses', valor:trajetoria[6]},
      {label:'Em 1 ano',   valor:trajetoria[12]},
      {label:'Em 2 anos',  valor:trajetoria[24]},
      {label:'Em 5 anos',  valor:trajetoria[60]},
    ]
  };
}

function renderProjecoesTabHTML(){
  const r = calcularProjecoes();
  if(r.semDados){
    return `
      <div class="card card-full" style="text-align:center;padding:48px 20px">
        <div style="font-size:38px;margin-bottom:12px">📈</div>
        <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px">Ainda não temos dados suficientes</div>
        <div style="font-size:13px;color:var(--muted);max-width:340px;margin:0 auto">Registre seus lançamentos pra começarmos a projetar seu futuro financeiro.</div>
      </div>`;
  }

  return `
    <div class="card card-full" style="margin-bottom:16px">
      <h3><span class="dot" style="background:var(--accent)"></span>Parâmetros da projeção</h3>
      <div class="form-row" style="margin-top:12px">
        <div class="field">
          <label>Taxa de retorno esperada (%/mês)</label>
          <input type="number" value="${r.taxa}" step="0.1" min="0" max="5" oninput="atualizarProjecaoTaxa(this.value)">
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:8px">
        Baseado na sua média de poupança dos últimos 6 meses: <strong style="color:var(--text)">${fmtR(r.mediaPoupanca)}</strong>/mês
        ${r.mediaPoupanca<=0?' <span style="color:#f97316">(negativa — a projeção considera aporte zero até você voltar a poupar)</span>':''}
      </div>
    </div>

    <div class="card card-full" style="margin-bottom:16px">
      <h3><span class="dot" style="background:var(--accent)"></span>Sua trajetória patrimonial</h3>
      <div class="chart-wrap" style="height:200px;margin-top:12px"><canvas id="c-projecao"></canvas></div>
    </div>

    <div class="card card-full">
      <h3><span class="dot" style="background:var(--accent)"></span>Marcos futuros</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
        ${r.marcos.map(m=>`
          <div style="background:var(--surface2);border-radius:10px;padding:14px">
            <div style="font-size:11px;color:var(--muted)">${m.label}</div>
            <div style="font-size:17px;font-weight:700;color:var(--accent);margin-top:4px">${fmtR(m.valor)}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function desenharGraficoProjecao(){
  const r = calcularProjecoes();
  if(r.semDados) return;
  if(typeof destroyChart==='function') destroyChart('projecao');
  const ctx = document.getElementById('c-projecao');
  if(!ctx || typeof Chart==='undefined') return;
  charts['projecao'] = new Chart(ctx, {
    type:'line',
    data:{
      labels: r.trajetoria.map((_,i)=>i),
      datasets:[{
        data: r.trajetoria,
        borderColor:'#C8A96E',
        backgroundColor:'rgba(200,169,110,.12)',
        fill:true, tension:.3, pointRadius:0, borderWidth:2,
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:(ctx)=>fmtR(ctx.raw)}} },
      scales:{
        x:{ display:false },
        y:{ ticks:{color:'#666',font:{size:10},callback:v=>'R$'+(v/1000).toFixed(0)+'k'}, grid:{color:'rgba(255,255,255,.04)'}, border:{display:false} }
      }
    }
  });
}

function renderScore(){
  try{
    const el = document.getElementById('score-content');
    if(!el) return;

    const abas = [['score','📊 Score'],['insights','💡 Insights'],['desafios','🏆 Desafios'],['projecoes','📈 Projeções']];
    const tabBar = `
      <div style="display:flex;gap:4px;margin-bottom:16px;background:var(--surface2);padding:4px;border-radius:10px">
        ${abas.map(([id,label])=>`
          <button onclick="trocarAbaPatrimonio('${id}')" style="flex:1;padding:9px 4px;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;background:${_patrimonioTab===id?'var(--accent)':'transparent'};color:${_patrimonioTab===id?'#0f0f0f':'var(--muted)'}">${label}</button>
        `).join('')}
      </div>`;

    let conteudo = '';
    if(_patrimonioTab==='insights') conteudo = renderInsightsTabHTML();
    else if(_patrimonioTab==='desafios') conteudo = renderDesafiosTabHTML();
    else if(_patrimonioTab==='projecoes') conteudo = renderProjecoesTabHTML();
    else conteudo = renderScoreTabHTML();

    el.innerHTML = tabBar + conteudo;

    if(_patrimonioTab==='projecoes') desenharGraficoProjecao();
  }catch(e){console.error('renderScore error:',e);}
}

// ─── Próximas funcionalidades do Patrimônio entram aqui, uma de cada vez: ───
// 4) Evolução patrimonial
// 5) Planejamento para liberdade financeira
// 6) Recomendações inteligentes
