(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const TYPES = [
    ...Array.from({length:9},(_,i)=>`${i+1}m`), ...Array.from({length:9},(_,i)=>`${i+1}p`), ...Array.from({length:9},(_,i)=>`${i+1}s`),
    ...Array.from({length:7},(_,i)=>`${i+1}z`)
  ];
  const SUITS = ['m','p','s'];
  const LABELS = {m:'萬子',p:'筒子',s:'索子',z:'字牌'};
  const HONOR_NAMES = {1:'東',2:'南',3:'西',4:'北',5:'白',6:'發',7:'中'};
  const DEFAULT_RULES = { players:4, openTanyao:true, kiriage:false, kazoe:true, doubleYakuman:true, doubleWind4:false, redDora:true, uraDora:true, kitaDora:true, tsumoLoss:true };
  const saved = (() => { try { return JSON.parse(localStorage.getItem('mahjongRules') || localStorage.getItem('mahjong4Rules') || 'null'); } catch { return null; }})();
  const rules = {...DEFAULT_RULES, ...(saved && (saved.players === 3 || saved.players === 4) ? saved : {})};
  const playableTypes = () => rules.players===3 ? TYPES.filter(t=>!(suit(t)==='m' && num(t)>=2 && num(t)<=8)) : TYPES;
  const isSanma = () => rules.players===3;

  let hand = [];
  let waitHand = [];
  let melds = [];
  let photoTarget = 'auto';
  let win = null;
  let red = new Set();
  let kitaCount = 0;
  let doraIndicators = new Set();
  let uraIndicators = new Set();
  let manualHan = 2;
  let manualDealer = false;
  let pending = {};
  let scorePlayer = 'child';
  let scoreRange = 'normal';

  const yakuCatalog = [
    {name:'立直', han:1, open:'—', freq:41.85, note:'門前のみ'},
    {name:'一発', han:1, open:'—', freq:9.19, note:'立直系'},
    {name:'門前清自摸和', han:1, open:'—', freq:17.79, note:'門前のみ'},
    {name:'断么九', han:1, open:1, freq:23.33, note:'喰いタン設定時'},
    {name:'平和', han:1, open:'—', freq:19.88, note:'門前のみ'},
    {name:'一盃口', han:1, open:'—', freq:4.25, note:'門前のみ'},
    {name:'役牌', han:1, open:1, freq:null, note:'自風・場風・三元牌など。出現率は牌種・局面で変動'},
    {name:'海底摸月', han:1, open:1, freq:0.36, note:''},
    {name:'河底撈魚', han:1, open:1, freq:0.58, note:''},
    {name:'嶺上開花', han:1, open:1, freq:0.28, note:''},
    {name:'槍槓', han:1, open:1, freq:0.05, note:''},
    {name:'ダブル立直', han:2, open:'—', freq:0.21, note:'門前のみ'},
    {name:'三色同順', han:2, open:1, freq:3.40, note:'鳴くと1翻'},
    {name:'一気通貫', han:2, open:1, freq:1.60, note:'鳴くと1翻'},
    {name:'混全帯么九', han:2, open:1, freq:1.10, note:'鳴くと1翻'},
    {name:'七対子', han:2, open:'—', freq:2.20, note:'25符固定'},
    {name:'対々和', han:2, open:2, freq:3.10, note:''},
    {name:'三色同刻', han:2, open:2, freq:0.05, note:''},
    {name:'三暗刻', han:2, open:2, freq:0.69, note:''},
    {name:'三槓子', han:2, open:2, freq:0.005, note:''},
    {name:'小三元', han:2, open:2, freq:0.11, note:'役牌2組分を別途加算'},
    {name:'混老頭', han:2, open:2, freq:0.054, note:'対々和などと複合'},
    {name:'純全帯么九', han:3, open:2, freq:0.34, note:'鳴くと2翻'},
    {name:'混一色', han:3, open:2, freq:6.27, note:'鳴くと2翻'},
    {name:'二盃口', han:3, open:'—', freq:0.048, note:'門前のみ'},
    {name:'清一色', han:6, open:5, freq:0.85, note:'鳴くと5翻'},
    {name:'国士無双', han:13, open:'門前のみ', freq:0.03442846, note:''},
    {name:'国士無双十三面待ち', han:26, open:'門前のみ', freq:0.00081045, note:''},
    {name:'四暗刻', han:13, open:'門前のみ', freq:0.04300192, note:''},
    {name:'四暗刻単騎', han:26, open:'門前のみ', freq:0.00511586, note:''},
    {name:'大三元', han:13, open:'鳴きOK', freq:0.03127012, note:''},
    {name:'小四喜', han:13, open:'鳴きOK', freq:0.00895590, note:''},
    {name:'大四喜', han:26, open:'鳴きOK', freq:0.00039780, note:''},
    {name:'字一色', han:13, open:'鳴きOK', freq:0.00394883, note:''},
    {name:'緑一色', han:13, open:'鳴きOK', freq:0.00150801, note:''},
    {name:'清老頭', han:13, open:'鳴きOK', freq:0.00109510, note:''},
    {name:'九蓮宝燈', han:13, open:'門前のみ', freq:0.00086702, note:''},
    {name:'純正九蓮宝燈', han:26, open:'門前のみ', freq:0.00005504, note:''},
    {name:'四槓子', han:13, open:'鳴きOK', freq:0.0002, note:''},
    {name:'天和', han:13, open:'門前のみ', freq:0.00036836, note:''},
    {name:'地和', han:13, open:'門前のみ', freq:0.00096609, note:''}
  ];

  const el = id => $(id);
  // ============================================================
  // 牌画像：ここだけ編集すれば牌デザインを差し替えられる
  // PNGファイルはGitHubリポジトリ直下に置く。
  // 例：1mの画像を差し替える場合は、ルートの tile-1m.png を交換する。
  // ファイル名は変更しないこと。
  // ============================================================
  const TILE_IMAGES = {
    '1m':'./tile-1m.png','2m':'./tile-2m.png','3m':'./tile-3m.png','4m':'./tile-4m.png','5m':'./tile-5m.png','r5m':'./r5m.png','6m':'./tile-6m.png','7m':'./tile-7m.png','8m':'./tile-8m.png','9m':'./tile-9m.png',
    '1p':'./tile-1p.png','2p':'./tile-2p.png','3p':'./tile-3p.png','4p':'./tile-4p.png','5p':'./tile-5p.png','r5p':'./r5p.png','6p':'./tile-6p.png','7p':'./tile-7p.png','8p':'./tile-8p.png','9p':'./tile-9p.png',
    '1s':'./tile-1s.png','2s':'./tile-2s.png','3s':'./tile-3s.png','4s':'./tile-4s.png','5s':'./tile-5s.png','r5s':'./r5s.png','6s':'./tile-6s.png','7s':'./tile-7s.png','8s':'./tile-8s.png','9s':'./tile-9s.png',
    '1z':'./tile-1z.png','2z':'./tile-2z.png','3z':'./tile-3z.png','4z':'./tile-4z.png','5z':'./tile-5z.png','6z':'./tile-6z.png','7z':'./tile-7z.png'
  };
  const TILE_BACK_IMAGE = './tile-back.png';
  const tileImg = (t, cls='', isRed=false) => { const key=isRed && TILE_IMAGES[`r${t}`] ? `r${t}` : t; return `<img class="${cls}" src="${TILE_IMAGES[key]}" alt="${key}" loading="eager">`; };
  const tileBackPath = () => TILE_BACK_IMAGE;
  const clone = o => JSON.parse(JSON.stringify(o));
  const suit = t => t[1];
  const num = t => +t[0];
  const isHonor = t => suit(t)==='z';
  const isTerminal = t => !isHonor(t) && (num(t)===1 || num(t)===9);
  const isSimple = t => !isHonor(t) && num(t)>=2 && num(t)<=8;
  const isTerminalOrHonor = t => isHonor(t) || isTerminal(t);
  const isWind = t => ['1z','2z','3z','4z'].includes(t);
  const isDragon = t => ['5z','6z','7z'].includes(t);
  const idOf = t => TYPES.indexOf(t);

  function counts(arr){ const c={}; arr.forEach(t=>c[t]=(c[t]||0)+1); return c; }
  function allTiles(){ return [...hand, ...melds.flatMap(m=>m.tiles)]; }
  function unique(arr){ return [...new Set(arr)]; }
  function tileCount(t){ return hand.filter(x=>x===t).length + melds.reduce((a,m)=>a+m.tiles.filter(x=>x===t).length,0); }
  function closed(){ return melds.every(m=>m.type==='ankan'); }
  function openMelds(){ return melds.filter(m=>m.type!=='ankan'); }
  function groupKey(g){ return g.join(','); }
  function isSeq(g){ return g.length===3 && !isHonor(g[0]) && suit(g[0])===suit(g[1]) && suit(g[1])===suit(g[2]) && num(g[1])===num(g[0])+1 && num(g[2])===num(g[1])+1; }
  function isTrip(g){ return g.length>=3 && g.every(t=>t===g[0]); }
  function sortedTiles(arr){ return [...arr].sort((a,b)=>idOf(a)-idOf(b)); }

  function nextDora(ind){
    if (isHonor(ind)) {
      if (['1z','2z','3z','4z'].includes(ind)) return ['1z','2z','3z','4z'][(['1z','2z','3z','4z'].indexOf(ind)+1)%4];
      return ['5z','6z','7z'][(['5z','6z','7z'].indexOf(ind)+1)%3];
    }
    return `${num(ind)===9?1:num(ind)+1}${suit(ind)}`;
  }

  function doraCount(){
    if (!rules.redDora && !rules.uraDora) return 0;
    const tiles=allTiles(); let n=0;
    doraIndicators.forEach(i=>{ const d=nextDora(i); n+=tiles.filter(t=>t===d).length; });
    if (rules.redDora) red.forEach(t=>{ if (['5m','5p','5s'].includes(t) && !(isSanma()&&t==='5m')) n += hand.filter(x=>x===t).length>0 ? 1 : 0; });
    if (rules.uraDora && (el('riichi').checked || el('doubleRiichi').checked)) uraIndicators.forEach(i=>{ const d=nextDora(i); n+=tiles.filter(t=>t===d).length; });
    if(isSanma()&&rules.kitaDora)n += kitaCount;
    return n;
  }

  function renderTileGroups(target, onPick, opts={}){
    target.innerHTML='';
    ['m','p','s','z'].forEach(s=>{
      const box=document.createElement('div'); box.className='tile-group';
      const h=document.createElement('h3'); h.textContent=LABELS[s]; box.appendChild(h);
      const grid=document.createElement('div'); grid.className='tile-grid-modal';
      playableTypes().filter(t=>suit(t)===s).forEach(t=>{
        const b=document.createElement('button'); b.className='tile-choice'; b.innerHTML=tileImg(t);
        b.title=t; b.onclick=()=>onPick(t); grid.appendChild(b);
      }); box.appendChild(grid); target.appendChild(box);
    });
    if(opts.red && rules.redDora){
      const box=document.createElement('div'); box.className='tile-group red-tile-group';
      const h=document.createElement('h3'); h.textContent='赤ドラ'; box.appendChild(h);
      const grid=document.createElement('div'); grid.className='tile-grid-modal red-tile-grid';
      ['5m','5p','5s'].forEach(t=>{
        if(isSanma() && t==='5m') return;
        const b=document.createElement('button'); b.className='tile-choice red-tile-choice'; b.innerHTML=tileImg(t,'',true);
        b.title=`赤${t[0]}${t[1]==='m'?'萬':t[1]==='p'?'筒':'索'}`;
        b.onclick=()=>onPick(t,{red:true}); grid.appendChild(b);
      }); box.appendChild(grid); target.appendChild(box);
    }
  }

  function openModal(id){ el(id).classList.remove('hidden'); }
  function closeModal(id){ el(id).classList.add('hidden'); }
  document.querySelectorAll('[data-close-modal]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.closeModal)));
  document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m) m.classList.add('hidden')}));

  function navigate(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id)); window.scrollTo({top:0,behavior:'smooth'}); if(id==='scoreScreen')renderScoreTable(); if(id==='yakuScreen')renderYakuTable(); }
  document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.screen)));
  document.querySelectorAll('.backBtn').forEach(b=>b.addEventListener('click',()=>navigate('homeScreen')));
  el('homeBtn').onclick=()=>navigate('homeScreen');

  function updateRuleSummary(){
    const bits=[rules.players===3?'三人麻雀':'四人麻雀']; if(rules.openTanyao)bits.push('喰いタン'); if(rules.kiriage)bits.push('切り上げ満貫'); if(rules.redDora)bits.push('赤ドラ'); if(rules.uraDora)bits.push('裏ドラ'); if(isSanma()&&rules.kitaDora)bits.push('北抜き'); if(isSanma()&&rules.tsumoLoss)bits.push('ツモ損');
    el('ruleSummary').textContent=bits.join(' ・ ');
  }
  function syncSeatDealer(){
    if(el('seat').value==='1z') el('dealer').value='true';
    else el('dealer').value='false';
  }
  function syncPlayerModeUI(){
    const sanma=isSanma();
    syncSeatDealer();
    document.querySelectorAll('[data-player-mode]').forEach(b=>b.classList.toggle('active',(sanma?'3':'4')===b.dataset.playerMode));
    const seat=el('seat'), round=el('round');
    [...seat.options].forEach(o=>o.hidden=sanma&&o.value==='4z'); [...round.options].forEach(o=>o.hidden=sanma&&o.value==='4z');
    if(sanma && (seat.value==='4z'||round.value==='4z')){seat.value='1z';round.value='1z';}
    el('sanmaOnlySettings').classList.toggle('hidden',!sanma); el('kitaBtn').classList.toggle('hidden',!sanma);
    if(sanma){red.delete('5m');}
    el('autoPhotoBtn').textContent='📷 写真を撮る';
    if(el('kitaBtn')) el('kitaBtn').textContent=`🀄 北を抜く（北抜き）${kitaCount?` ×${kitaCount}`:''}`;
  }
  function loadSettingsUI(){ ['openTanyao','kiriage','kazoe','doubleYakuman','doubleWind4','redDora','uraDora','kitaDora','tsumoLoss'].forEach(k=>{const x=el(`set${k.charAt(0).toUpperCase()+k.slice(1)}`);if(x)x.checked=!!rules[k]}); syncPlayerModeUI(); }
  el('settingsBtn').onclick=()=>{loadSettingsUI();openModal('settingsModal')};
  document.querySelectorAll('[data-player-mode]').forEach(b=>b.onclick=()=>{rules.players=+b.dataset.playerMode;if(!isSanma())kitaCount=0;syncPlayerModeUI();updateRuleSummary();renderHand();renderWin();renderMiniPicker(el('doraPicker'),doraIndicators);renderMiniPicker(el('uraPicker'),uraIndicators);analyze();});
  el('saveSettings').onclick=()=>{ ['openTanyao','kiriage','kazoe','doubleYakuman','doubleWind4','redDora','uraDora','kitaDora','tsumoLoss'].forEach(k=>{const x=el(`set${k.charAt(0).toUpperCase()+k.slice(1)}`);if(x)rules[k]=x.checked}); localStorage.setItem('mahjongRules',JSON.stringify(rules)); updateRuleSummary(); closeModal('settingsModal'); syncRuleEffects(); renderTileGroups(el('tilePicker'),t=>{}); renderHand(); renderWin(); renderMiniPicker(el('doraPicker'),doraIndicators); renderMiniPicker(el('uraPicker'),uraIndicators); analyze(); manualCalc(); };

  // Calculator tabs
  document.querySelectorAll('.calc-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.calc-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.calc-pane').forEach(x=>x.classList.remove('active'));el(`${b.dataset.calcTab}Pane`).classList.add('active')});

  // Manual calculator
  ['ankoC','ankoY','minkoC','minkoY','ankanC','ankanY','minkanC','minkanY'].forEach(k=>{const s=el(`m_${k}`);for(let i=0;i<=4;i++)s.add(new Option(i,i));s.addEventListener('change',manualCalc)});
  ['janto','machi','agari','special','manualOn','manualFu'].forEach(k=>el(`m_${k}`).addEventListener('change',manualCalc));
  el('m_minus').onclick=()=>{manualHan=Math.max(0,manualHan-1);el('m_han').textContent=manualHan;manualCalc()};
  el('m_plus').onclick=()=>{manualHan=Math.min(26,manualHan+1);el('m_han').textContent=manualHan;manualCalc()};
  document.querySelectorAll('[data-parent]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-parent]').forEach(x=>x.classList.remove('active'));b.classList.add('active');manualDealer=b.dataset.parent==='true';manualCalc()}));

  function manualCalc(){
    const v=k=>+el(`m_${k}`).value;
    const mf=v('ankoC')*4+v('ankoY')*8+v('minkoC')*2+v('minkoY')*4+v('minkanC')*8+v('minkanY')*16+v('ankanC')*16+v('ankanY')*32;
    const jantoFu=el('m_janto').value.includes('以外')?0:2;
    const machiValue=el('m_machi').value;
    const machiFu=(machiValue.includes('両面')||machiValue.includes('シャンポン'))?0:2;
    const agariFu=el('m_agari').value.includes('ロン')?0:2;
    // 元のExcel B16と同じく、小計を10符単位に切り上げる。
    const subtotal=Math.ceil((mf+jantoFu+machiFu+agariFu)/10)*10;
    let f;
    const sp=el('m_special').value;
    if(sp.includes('七対子')) f=25;
    else if(sp.includes('平和ツモ')) f=20;
    else if(sp.includes('門前ロン')) f=subtotal+10+20;
    else f=subtotal+20;
    // 元Excel仕様：手動符は入力値をそのまま使用し、20符を追加しない。
    if(el('m_manualOn').checked && el('m_manualFu').value.trim()!=='') f=Math.max(0,+el('m_manualFu').value);
    el('m_mentsuFu').textContent=`${mf}符`;
    el('m_subtotal').textContent=`${subtotal}符`;
    el('m_fu').textContent=`${f}符`;
    const res=excelScoreResult(manualHan,f,manualDealer,el('m_agari').value==='ロン');
    const limit=limitLabel(manualHan);
    el('m_score').textContent=limit ? `${limit}：${res}` : res;
    const ao=excelAoten(manualHan,f,manualDealer,el('m_agari').value==='ロン');
    el('m_aoten').textContent=ao;
    el('m_manualFu').disabled=!el('m_manualOn').checked;
  }
  // 点数計算：ここで扱う「素点」は、添付の点数表に合わせた
  // ロン基準の点数。
  // 子：32×符×2^(飜-1)
  // 親：48×符×2^(飜-1)
  // これを100点単位で切り上げる。満貫以上は各上限点に置き換える。
  function scoreRaw(han,fu,parent){
    if(han>=13 && rules.kazoe) return parent?48000:32000;
    if(han>=11) return parent?36000:24000;
    if(han>=8) return parent?24000:16000;
    if(han>=6) return parent?18000:12000;
    if(han>=5) return parent?12000:8000;
    const mult=parent?48:32;
    let raw=mult*fu*Math.pow(2,han-1);
    const cap=parent?12000:8000;
    if(rules.kiriage && ((han===4&&fu>=30)||(han===3&&fu>=60))) raw=cap;
    return Math.min(raw,cap);
  }
  function round100(x){return Math.ceil(x/100)*100;}
  function scoreParts(han,fu,parent,isRon){
    const raw=scoreRaw(han,fu,parent);
    if(isRon) return {ron:round100(raw)};
    if(isSanma()){
      if(parent){
        const each=rules.tsumoLoss?round100(raw/3):round100(raw/3);
        return {tsumo:each};
      }
      if(rules.tsumoLoss) return {tsumoLow:round100(raw/4),tsumoHigh:round100(raw/2)};
      return {tsumoLow:round100(raw/3),tsumoHigh:round100(raw*2/3)};
    }
    if(parent) return {tsumo:round100(raw/3)};
    return {tsumoLow:round100(raw/4),tsumoHigh:round100(raw/2)};
  }
  function formatScorePart(n){return Number(n).toLocaleString('ja-JP');}
  function excelScoreResult(han,fu,parent,isRon){
    const part=scoreParts(han,fu,parent,isRon);
    if(isRon) return `${formatScorePart(part.ron)}点`;
    if(isSanma()) return parent ? `${formatScorePart(part.tsumo)}点オール` : `${formatScorePart(part.tsumoLow)}-${formatScorePart(part.tsumoHigh)}点`;
    if(parent) return `${formatScorePart(part.tsumo)}点オール`;
    return `${formatScorePart(part.tsumoLow)}-${formatScorePart(part.tsumoHigh)}点`;
  }
  function excelAoten(han,fu,parent,isRon){
    const raw=(parent?48:32)*fu*Math.pow(2,han-1);
    if(isRon) return `${formatScorePart(raw)}点`;
    if(parent) return `${formatScorePart(raw/3)}点オール`;
    return `${formatScorePart(raw/4)}-${formatScorePart(raw/2)}点`;
  }

  // Hand picker
  el('openHandPicker').onclick=()=>{
    renderTileGroups(el('tilePicker'), (t,opts={})=>{
      const max=14+melds.filter(m=>['ankan','minkan','shouminkan'].includes(m.type)).length-melds.reduce((a,m)=>a+m.tiles.length,0);
      if(hand.length>=max)return;
      if(tileCount(t)>=4)return;
      if(opts.red){ if(!rules.redDora || red.has(t)) return; red.add(t); }
      hand.push(t); renderHand(); renderWin(); analyze();
    }, {red:true}); openModal('tileModal');
  };
  el('clearHand').onclick=()=>{hand=[];win=null;red.clear();kitaCount=0;el('kitaBtn').textContent='🀄 北を抜く（北抜き）';renderHand();renderWin();analyze()};

  // ============================================================
  // 写真認証：YOLO/ONNXをブラウザ内で実行する。
  // 認識後は既存の「選択した手牌」にそのまま反映する。
  // ============================================================
  // 画像認証モデルはGitHub Releaseに置いた固定モデルを使用する。
  // アプリ本体には約80MBのONNXを同梱しないため、更新ZIPを軽量に保てる。
  const PHOTO_MODEL_URL='https://github.com/yackmaaaaan/score-calculation13/releases/download/model-v1/tile-detector.onnx';
  const PHOTO_CLASS_NAMES=['1m','1p','1s','1z','2m','2p','2s','2z','3m','3p','3s','3z','4m','4p','4s','4z','5m','5mr','5p','5pr','5s','5sr','5z','6m','6p','6s','6z','7m','7p','7s','7z','8m','8p','8s','9m','9p','9s'];
  let photoSession=null;
  let photoSessionPromise=null;

  async function photoFetchModel(){
    const url=PHOTO_MODEL_URL;
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),120000);
      let res;
      try{
        res=await fetch(url,{cache:'force-cache',mode:'cors',redirect:'follow',signal:controller.signal});
      }finally{clearTimeout(timer)}
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf=await res.arrayBuffer();
      if(buf.byteLength<100000){
        const head=new TextDecoder().decode(new Uint8Array(buf.slice(0,120)));
        if(head.includes('git-lfs.github.com/spec')) throw new Error('Git LFSポインタが返されました');
        throw new Error(`モデルファイルが小さすぎます（${buf.byteLength} bytes）`);
      }
      return new Uint8Array(buf);
    }catch(err){
      console.error('画像認証モデル取得失敗:',url,err);
      throw new Error(`画像認証モデルを取得できませんでした：${err?.message||err||'unknown error'}`);
    }
  }

  async function photoLoadSession(){
    if(photoSession) return photoSession;
    if(photoSessionPromise) return photoSessionPromise;
    if(!window.ort) throw new Error('画像認証エンジンを読み込めませんでした');
    // GitHub PagesではWebGPU/WASMの相性問題が端末ごとに出るため、まずWASMで確実に初期化する。
    window.ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
    window.ort.env.wasm.proxy=false;
    photoSessionPromise=(async()=>{
      const model=await photoFetchModel();
      try{
        return await window.ort.InferenceSession.create(model,{executionProviders:['wasm']});
      }catch(wasmErr){
        // WASM初期化に失敗した端末だけWebGPUを試す。
        try{
          return await window.ort.InferenceSession.create(model,{executionProviders:['webgpu']});
        }catch(gpuErr){
          const a=wasmErr?.message||String(wasmErr), b=gpuErr?.message||String(gpuErr);
          throw new Error(`画像認証モデルを読み込めませんでした。WASM: ${a} / WebGPU: ${b}`);
        }
      }
    })().then(s=>{photoSession=s;return s}).catch(err=>{photoSessionPromise=null;throw err});
    return photoSessionPromise;
  }
  function photoLetterbox(w,h,size){const scale=Math.min(size/w,size/h);const nw=Math.round(w*scale),nh=Math.round(h*scale);return {scale,padX:(size-nw)/2,padY:(size-nh)/2};}
  function photoIoU(a,b){const ax1=a.x-a.width/2,ay1=a.y-a.height/2,ax2=a.x+a.width/2,ay2=a.y+a.height/2;const bx1=b.x-b.width/2,by1=b.y-b.height/2,bx2=b.x+b.width/2,by2=b.y+b.height/2;const iw=Math.max(0,Math.min(ax2,bx2)-Math.max(ax1,bx1)),ih=Math.max(0,Math.min(ay2,by2)-Math.max(ay1,by1));const inter=iw*ih;if(!inter)return 0;return inter/(a.width*a.height+b.width*b.height-inter)}
  function photoNms(boxes,iou=0.5){const groups=new Map();boxes.forEach(b=>{if(!groups.has(b.classIndex))groups.set(b.classIndex,[]);groups.get(b.classIndex).push(b)});const out=[];for(const g of groups.values()){g.sort((a,b)=>b.score-a.score);const used=new Array(g.length).fill(false);for(let i=0;i<g.length;i++){if(used[i])continue;out.push(g[i]);for(let j=i+1;j<g.length;j++)if(!used[j]&&photoIoU(g[i],g[j])>iou)used[j]=true}}return out}
  async function recognizePhoto(file){
    const img=await createImageBitmap(file);
    const size=640, lb=photoLetterbox(img.width,img.height,size);
    const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='rgb(114,114,114)';ctx.fillRect(0,0,size,size);ctx.drawImage(img,lb.padX,lb.padY,img.width*lb.scale,img.height*lb.scale);
    const px=ctx.getImageData(0,0,size,size).data, plane=size*size, data=new Float32Array(3*plane);
    for(let i=0;i<plane;i++){data[i]=px[i*4]/255;data[plane+i]=px[i*4+1]/255;data[plane*2+i]=px[i*4+2]/255}
    const ort=window.ort, session=await photoLoadSession(), input=session.inputNames[0], output=session.outputNames[0];
    const result=await session.run({[input]:new ort.Tensor('float32',data,[1,3,size,size])});
    const out=result[output], dims=out.dims;
    if(dims.length!==3 || dims[0]!==1) throw new Error(`認識モデルの出力形式が不正です（${dims.join('x')}）`);
    const channels=dims[1], anchors=dims[2], classes=channels-4;
    if(classes!==PHOTO_CLASS_NAMES.length)throw new Error(`認識モデルの牌種数が一致しません（${classes} / ${PHOTO_CLASS_NAMES.length}）`);
    const raw=out.data, candidates=[];
    for(let a=0;a<anchors;a++){let best=-1,bestScore=0;for(let c=0;c<classes;c++){const sc=raw[(4+c)*anchors+a];if(sc>bestScore){bestScore=sc;best=c}}if(bestScore<0.45)continue;const x=(raw[a]-lb.padX)/lb.scale,y=(raw[anchors+a]-lb.padY)/lb.scale,w=raw[2*anchors+a]/lb.scale,h=raw[3*anchors+a]/lb.scale;if(w>8&&h>8)candidates.push({x,y,width:w,height:h,score:bestScore,classIndex:best})}
    const kept=photoNms(candidates).sort((a,b)=>a.x-b.x);
    return kept.map(b=>({label:PHOTO_CLASS_NAMES[b.classIndex],confidence:b.score,x:b.x}));
  }
  function normalizePhotoTile(label){return label.replace('5mr','5m').replace('5pr','5p').replace('5sr','5s')}
  function applyPhotoTiles(results,target){
    const ordered=results.map(r=>({tile:normalizePhotoTile(r.label),red:/^5[mspr]r$/.test(r.label),confidence:r.confidence})).filter(r=>playableTypes().includes(r.tile));
    if(target==='wait'){
      waitHand=ordered.map(r=>r.tile); renderWaitHand(); renderWaitResult();
      return ordered.length;
    }
    hand=ordered.slice(0,14).map(r=>r.tile); win=null; red.clear();
    ordered.slice(0,14).forEach(r=>{if(r.red)red.add(r.tile)});
    renderHand();renderWin();analyze();
    return ordered.length;
  }
  function renderPhotoRecognized(results){
    const box=el('photoRecognized');box.innerHTML=results.length?`認識：${results.length}枚 <span class=\"muted\">（認識結果は手動で修正できます）</span>`:'牌を認識できませんでした';box.classList.remove('hidden');
  }
  function openPhoto(target){photoTarget=target;el('photoRecognized').classList.add('hidden');el('photoProgress').classList.add('hidden');el('photoPreviewWrap').classList.add('hidden');el('photoInput').value='';openModal('photoModal')}
  async function handlePhoto(file){
    if(!file)return;
    el('photoProgress').textContent='画像を認識中… 初回は認識エンジンの読み込みに少し時間がかかる場合があります。';el('photoProgress').classList.remove('hidden');
    const url=URL.createObjectURL(file);el('photoPreview').src=url;el('photoPreviewWrap').classList.remove('hidden');
    try{
      const results=await recognizePhoto(file);
      const n=applyPhotoTiles(results,photoTarget);
      renderPhotoRecognized(results);
      el('photoProgress').textContent=`認識完了：${n}枚。`;
      if(photoTarget==='wait' && n!==13)el('photoProgress').textContent+=` 待ち判定は13枚にすると判定できます。`;
      setTimeout(()=>closeModal('photoModal'),700);
    }catch(err){
      console.error(err);el('photoProgress').textContent=`認識に失敗しました：${err.message||err}`;el('photoProgress').classList.remove('status');el('photoProgress').classList.add('status','err');
    }
  }
  el('autoPhotoBtn').onclick=()=>openPhoto('auto');
  el('waitPhotoBtn').onclick=()=>openPhoto('wait');
  el('photoChooseBtn').onclick=()=>el('photoInput').click();
  el('photoGalleryBtn').onclick=()=>el('photoGalleryInput').click();
  el('photoInput').addEventListener('change',e=>handlePhoto(e.target.files?.[0]));
  el('photoGalleryInput').addEventListener('change',e=>handlePhoto(e.target.files?.[0]));

  // 待ち判定
  el('openWaitHandPicker').onclick=()=>{
    renderTileGroups(el('waitTilePicker'),t=>{if(waitHand.length>=13)return;if(waitHand.filter(x=>x===t).length>=4)return;waitHand.push(t);renderWaitHand();renderWaitResult()});
    openModal('waitTileModal');
  };
  el('clearWaitHand').onclick=()=>{waitHand=[];renderWaitHand();renderWaitResult()};
  function renderWaitHand(){
    const box=el('waitHandView');box.innerHTML='';
    waitHand.forEach((t,i)=>{const b=document.createElement('button');b.className='tile-mini';b.innerHTML=tileImg(t);b.title='タップで1枚削除';b.onclick=e=>{e.stopPropagation();waitHand.splice(i,1);renderWaitHand();renderWaitResult()};box.appendChild(b)});
    el('waitHandPlaceholder').style.display=waitHand.length?'none':'inline';el('waitHandCount').textContent=waitHand.length;
  }
  function waitIsChiitoi14(arr){const c=counts(arr);return Object.keys(c).length===7&&Object.values(c).every(n=>n===2)}
  function waitIsKokushi14(arr){const req=['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'],c=counts(arr);return req.every(t=>c[t]>=1)&&req.some(t=>c[t]>=2)}
  function calcWaits(arr){
    if(arr.length!==13)return [];const c=counts(arr),out=[];
    playableTypes().forEach(t=>{if((c[t]||0)>=4)return;const a=arr.concat(t);let ok=decompositions(a,4).length>0;const cc=counts(a);if(!ok)ok=Object.keys(cc).length===7&&Object.values(cc).every(n=>n===2);if(!ok){const req=isSanma()?['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z']:['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'];ok=req.every(x=>cc[x]>=1)&&req.some(x=>cc[x]>=2)}if(ok)out.push(t)});
    return out;
  }
  function evaluateWaitTile(t){
    const oldHand=hand, oldWin=win, oldMelds=melds;
    hand=waitHand.concat(t); win=t; melds=[];
    const oldChecks={};
    ['riichi','doubleRiichi','ippatsu','rinshan','chankan','haitei','houtei','tenhou','chiihou'].forEach(id=>{oldChecks[id]=el(id).checked;el(id).checked=false});
    let best=null;
    if(isKokushi()||isChiitoi()){
      const d={groups:[],pair:null}; const ys=yakuList(d); const ym=yakumanMultiplier(ys);
      best={ys,ym,h:0,fu:ym?25:fuCalc(d)};
    }else{
      const ds=decompositions(hand,4);
      ds.forEach(d=>{
        const ys=yakuList(d), ym=yakumanMultiplier(ys);
        const h=ys.filter(y=>y.type!=='yakuman').reduce((a,y)=>a+y.han,0)+doraCount();
        if(!ys.length)return;
        const fu=fuCalc(d);
        if(!best||ym>best.ym||(ym===best.ym&&(h>best.h||(h===best.h&&fu>best.fu))))best={ys,ym,h,fu};
      });
    }
    ['riichi','doubleRiichi','ippatsu','rinshan','chankan','haitei','houtei','tenhou','chiihou'].forEach(id=>el(id).checked=oldChecks[id]);
    hand=oldHand; win=oldWin; melds=oldMelds;
    if(!best)return null;
    const dealer=el('dealer').value==='true', ron=el('winMethod').value==='ron';
    const doraH=0;
    const text=best.ym>=1?scoreYakuman(best.ym,ron,dealer):(limitLabel(best.h)?`${limitLabel(best.h)}：${scoreResult(best.h,best.fu,dealer,ron).text}`:scoreResult(best.h,best.fu,dealer,ron).text);
    const yaku=best.ys.filter(y=>y.type==='yakuman').map(y=>y.name);
    const normal=best.ys.filter(y=>y.type!=='yakuman').map(y=>y.name);
    return {tile:t,ys:best.ym>=1?yaku:normal,ym:best.ym,h:best.h,fu:best.fu,score:text};
  }
  function renderWaitResult(){
    const st=el('waitStatus'),box=el('waitResult');box.innerHTML='';el('waitCount').textContent='0種';
    if(waitHand.length!==13){st.className='status';st.textContent=`現在${waitHand.length}枚。13枚にしてね`;return}
    const waits=calcWaits(waitHand);
    if(!waits.length){st.className='status err';st.textContent='テンパイしていません';return}
    const evaluated=waits.map(evaluateWaitTile).filter(Boolean);
    st.className='status ok';st.textContent='テンパイしています';el('waitCount').textContent=`${waits.length}種`;
    const groups=new Map();
    evaluated.forEach(r=>{
      const key=`${r.ys.join('|')}__${r.score}`;
      if(!groups.has(key))groups.set(key,{...r,tiles:[]});
      groups.get(key).tiles.push(r.tile);
    });
    groups.forEach(g=>{
      const card=document.createElement('div');card.className='wait-score-card';
      const tiles=g.tiles.map(t=>tileImg(t)).join('');
      const yaku=g.ys.length?g.ys.join('・'):'役なし';
      card.innerHTML=`<div class="wait-score-tiles">${tiles}</div><div class="wait-score-yaku"><span>役</span><b>${yaku}</b></div><div class="wait-score-points"><span>点数</span><strong>${g.score}</strong></div>`;
      box.appendChild(card);
    });
  }

  function renderHand(){
    const box=el('handView'); box.innerHTML='';
    const redShown={m:false,p:false,s:false};
    hand.forEach((t,i)=>{
      const isRed=!redShown[suit(t)] && ['5m','5p','5s'].includes(t) && red.has(t);
      if(isRed) redShown[suit(t)]=true;
      const b=document.createElement('button'); b.className='tile-mini'; b.innerHTML=tileImg(t,'',isRed); b.title=isRed?'赤ドラ（タップで削除）':'タップで1枚削除';
      b.onclick=e=>{e.stopPropagation(); if(isRed) red.delete(t); hand.splice(i,1); if(win===t && !hand.includes(t))win=null; renderHand();renderWin();analyze()};
      box.appendChild(b);
    });
    ['m','p','s'].forEach(s=>{if(red.has(`5${s}`)&&!hand.includes(`5${s}`))red.delete(`5${s}`)});
    el('handPlaceholder').style.display=hand.length?'none':'inline'; el('handCount').textContent=hand.length; el('handLimit').textContent=14+melds.filter(m=>['ankan','minkan','shouminkan'].includes(m.type)).length-melds.reduce((a,m)=>a+m.tiles.length,0);
  }

  // Meld entry
  el('openMeldPicker').onclick=()=>openModal('meldModal');
  el('kitaBtn').onclick=()=>{
    if(!isSanma())return;
    if(hand.filter(t=>t==='4z').length + kitaCount >= 4) return;
    kitaCount++;
    el('kitaBtn').textContent=`🀄 北を抜く（北抜き）${kitaCount?` ×${kitaCount}`:''}`;
    analyze();
  };
  document.querySelectorAll('[data-meld-type]').forEach(b=>b.onclick=()=>{closeModal('meldModal'); if(b.dataset.meldType==='pon')startPon(); if(b.dataset.meldType==='chi')startChi(); if(b.dataset.meldType==='kan')openModal('kanModal');});
  document.querySelectorAll('[data-kan-type]').forEach(b=>b.onclick=()=>{pending.kanType=b.dataset.kanType;closeModal('kanModal');startKan()});
  function renderPonOrientation(t){const labels={left:'上家',middle:'対面',right:'下家'};document.querySelectorAll('#orientationModal [data-orientation]').forEach(b=>{const o=b.dataset.orientation;b.innerHTML=`<span class="orientation-icon"><span class="ori-tile${o==='left'?' rotated':''}">${tileImg(t)}</span><span class="ori-tile${o==='middle'?' rotated':''}">${tileImg(t)}</span><span class="ori-tile${o==='right'?' rotated':''}">${tileImg(t)}</span></span><b>${labels[o]}</b>`})}
  function startPon(){renderTileGroups(el('ponTiles'),t=>{if(tileCount(t)>1)return;pending.type='pon';pending.tile=t;renderPonOrientation(t);closeModal('ponModal');openModal('orientationModal')});openModal('ponModal')}
  function openCalledFrom(forChi=false){document.querySelectorAll('[data-called-from]').forEach(b=>{b.style.display=forChi && b.dataset.calledFrom!=='left'?'none':''});closeModal('chiCalledModal');closeModal('calledFromModal');openModal('calledFromModal')}
  document.querySelectorAll('[data-called-from]').forEach(b=>b.onclick=()=>{pending.from=b.dataset.calledFrom;pending.orientation=pending.from==='left'?'left':pending.from==='opposite'?'middle':'right';closeModal('calledFromModal');if(pending.type==='pon')commitPon();else if(pending.type==='chi')commitChi();else if(pending.type==='minkan')commitMinkan()});
  function commitPon(){ const t=pending.tile; if(!t||tileCount(t)>4)return; melds.push({type:'pon',tiles:[t,t,t],calledTile:t,from:pending.from,orientation:pending.orientation}); renderMelds(); renderHand(); analyze(); pending={}; }
  function commitMinkan(){ const t=pending.kanTile; if(!t||tileCount(t)>4)return; melds.push({type:'minkan',tiles:[t,t,t,t],calledTile:t,from:pending.from,orientation:pending.orientation||'left'}); renderMelds(); renderHand(); analyze(); pending={}; }
  document.querySelectorAll('[data-orientation]').forEach(b=>b.addEventListener('click',()=>{
    const o=b.dataset.orientation;
    pending.orientation=o;
    if(pending.type==='pon') pending.from=o==='left'?'left':o==='middle'?'opposite':'right';
    closeModal('orientationModal');
    if(Number.isInteger(pending.editMeld)){const i=pending.editMeld;melds[i].orientation=o;if(melds[i].type==='pon')melds[i].from=o==='left'?'left':o==='middle'?'opposite':'right';pending.editMeld=null;renderMelds();analyze();return;}
    if(pending.type==='pon')commitPon(); else if(pending.type==='minkan')commitMinkan();
  }));

  function startChi(){
    const sets=[];
    SUITS.forEach(s=>{
      for(let n=1;n<=7;n++){
        const ts=[`${n}${s}`,`${n+1}${s}`,`${n+2}${s}`];
        if(ts.every(t=>playableTypes().includes(t) && tileCount(t)<4)) sets.push(ts);
      }
    });
    const box=el('chiSets'); box.innerHTML='';
    sets.forEach(ts=>{
      const b=document.createElement('button');
      b.className='chi-called-card';
      b.innerHTML=ts.map(t=>tileImg(t,'meld-tile')).join('');
      b.onclick=()=>{
        pending.chiSet=ts; closeModal('chiModal');
        const cc=el('chiCalledTiles'); cc.innerHTML='';
        ts.forEach(t=>{
          const b2=document.createElement('button');
          b2.innerHTML=`鳴いた牌 ${tileImg(t,'meld-tile')}`;
          b2.onclick=()=>{pending.calledTile=t;pending.type='chi';closeModal('chiCalledModal');openCalledFrom(true)};
          cc.appendChild(b2);
        });
        openModal('chiCalledModal');
      };
      box.appendChild(b);
    });
    openModal('chiModal');
  }
  function commitChi(){const ts=pending.chiSet; if(!ts||ts.length!==3)return; if(ts.some(t=>tileCount(t)>4))return; melds.push({type:'chi',tiles:ts,calledTile:pending.calledTile,from:pending.from||'left',orientation:pending.orientation||'left'});renderHand();renderMelds();analyze();pending={};}
  function startKan(){
    const type=pending.kanType; const can=[];
    unique(playableTypes()).forEach(t=>{
      const existingPon=melds.some(m=>m.type==='pon'&&m.tiles[0]===t);
      if(type==='ankan'&&tileCount(t)===0)can.push(t);
      if(type==='minkan'&&tileCount(t)===0)can.push(t);
      if(type==='shouminkan'&&existingPon&&tileCount(t)<4)can.push(t);
    });
    if(!can.length){alert(type==='shouminkan'?'加槓できるポンがありません':'選択可能なカンがありません');return}
    const box=el('kanTiles');box.innerHTML='';can.forEach(t=>{const b=document.createElement('button');b.className='tile-choice';b.innerHTML=tileImg(t);b.onclick=()=>{pending.kanTile=t;pending.type=type;closeModal('kanTilesModal');if(type==='minkan'){openCalledFrom(false)}else if(type==='shouminkan'){commitShouminkan()}else commitAnkan()};box.appendChild(b)});el('kanTilesTitle').textContent=type==='ankan'?'暗槓：牌を選択':type==='minkan'?'大明槓：牌を選択':'加槓：牌を選択';openModal('kanTilesModal');
  }
  function commitAnkan(){const t=pending.kanTile;if(!t||tileCount(t)!==0)return;melds.push({type:'ankan',tiles:[t,t,t,t],calledTile:null,from:null,orientation:null});renderHand();renderMelds();analyze();pending={}}
  function commitShouminkan(){const t=pending.kanTile;const i=melds.findIndex(m=>m.type==='pon'&&m.tiles[0]===t);if(i<0||tileCount(t)>4)return; const old=melds[i];melds[i]={...old,type:'shouminkan',tiles:[t,t,t,t]};renderHand();renderMelds();analyze();pending={}}
  function renderMelds(){
    const list=el('meldList');list.innerHTML='';const view=el('meldView');view.innerHTML='';
    el('meldPlaceholder').style.display=melds.length?'none':'inline';
    melds.forEach((m,i)=>{
      const card=document.createElement('button');card.className='meld-card'; card.title='タップして編集';
      const orientationIndex=m.type==='ankan'? -1 : (m.orientation==='left'?0:m.orientation==='middle'?1:2);
      m.tiles.forEach((t,j)=>{const x=document.createElement('span');x.className='meld-tile'+(j===orientationIndex?' rotated':'');x.innerHTML=(m.type==='ankan'&&(j===0||j===m.tiles.length-1))?`<img src="${tileBackPath()}" alt="裏向き">`:tileImg(t);card.appendChild(x)});
      const del=document.createElement('span');del.className='del';del.textContent='×';card.appendChild(del);card.onclick=e=>{if(e.target===del){melds.splice(i,1);renderMelds();renderHand();analyze()}else openMeldEdit(i)};list.appendChild(card);
      const v=card.cloneNode(true);v.onclick=()=>openMeldEdit(i);view.appendChild(v);
    });
  }
  function openMeldEdit(i){const m=melds[i];const body=el('editMeldBody');body.innerHTML=`<p>種類：<b>${m.type==='chi'?'チー':m.type==='pon'?'ポン':m.type==='ankan'?'暗槓':m.type==='minkan'?'大明槓':'加槓'}</b></p><div class="edit-actions"><button id="editRotate">鳴いた牌の位置を変更</button><button id="editDelete">この副露を削除</button></div>`;el('editDelete').onclick=()=>{melds.splice(i,1);closeModal('editMeldModal');renderMelds();renderHand();analyze()};el('editRotate').onclick=()=>{closeModal('editMeldModal');if(m.type==='ankan')return;if(m.type==='pon')renderPonOrientation(m.tiles[0]);openModal('orientationModal');pending.editMeld=i};openModal('editMeldModal')}

  // Win selection
  function renderWin(){
    const box=el('winChoices');box.innerHTML='';const seen=unique(hand); seen.forEach(t=>{const b=document.createElement('button');b.className='tile-mini';b.innerHTML=tileImg(t);b.title=win===t?'和了牌を解除':'和了牌にする'; if(win===t)b.style.outline='2px solid #2563eb'; b.onclick=e=>{e.stopPropagation();win=win===t?null:t;renderWin();analyze()};box.appendChild(b)});
  }
  el('winView').addEventListener('click',()=>{if(!hand.length)return;renderWin();});

  // dora picker
  function renderMiniPicker(target, set){target.innerHTML='';playableTypes().forEach(t=>{const b=document.createElement('button');b.innerHTML=tileImg(t);b.classList.toggle('selected',set.has(t));b.onclick=()=>{if(set.has(t))set.delete(t);else {if(set.size>=5)return;set.add(t)}renderMiniPicker(target,set);analyze()};target.appendChild(b)})}
  renderMiniPicker(el('doraPicker'),doraIndicators); renderMiniPicker(el('uraPicker'),uraIndicators);

  el('seat').addEventListener('change',()=>{syncSeatDealer();analyze();});
  el('dealer').addEventListener('change',()=>{
    if(el('dealer').value==='true') el('seat').value='1z';
    else if(el('seat').value==='1z') el('seat').value='2z';
    analyze();
  });
  ['round','winMethod','riichi','doubleRiichi','ippatsu','rinshan','chankan','haitei','houtei','tenhou','chiihou'].forEach(id=>el(id).addEventListener('change',analyze));
  const specialIds=['riichi','doubleRiichi','ippatsu','rinshan','chankan','haitei','houtei','tenhou','chiihou'];
  function updateSpecialLabel(){}

  function decompositions(tiles, groupsNeeded){
    // 牌数カウントを直接再帰して、全ての4面子1雀頭分解を列挙する。
    const c=counts(tiles), out=[];
    function rec(pair, groups){
      let first=null;
      for(const t of playableTypes()){if((c[t]||0)>0){first=t;break;}}
      if(!first){if(pair&&groups.length===groupsNeeded)out.push({groups:groups.map(g=>g.slice()),pair:[pair,pair]});return;}
      if(groups.length>groupsNeeded)return;
      if(!pair && c[first]>=2){c[first]-=2;rec(first,groups);c[first]+=2;}
      if(groups.length<groupsNeeded && c[first]>=3){c[first]-=3;rec(pair,groups.concat([[first,first,first]]));c[first]+=3;}
      if(groups.length<groupsNeeded && !isHonor(first)){
        const n=num(first), ss=suit(first);
        if(n<=7){const ts=[`${n}${ss}`,`${n+1}${ss}`,`${n+2}${ss}`];if(ts.every(t=>(c[t]||0)>0)){ts.forEach(t=>c[t]--);rec(pair,groups.concat([ts]));ts.forEach(t=>c[t]++);}}
      }
    }
    rec(null,[]);
    const seen=new Set();
    return out.filter(d=>{const k=d.groups.map(groupKey).sort().join('|')+'|'+d.pair[0];if(seen.has(k))return false;seen.add(k);return true;});
  }

  function isChiitoi(){if(melds.length)return false;if(hand.length!==14)return false;const c=counts(hand);return Object.keys(c).length===7&&Object.values(c).every(n=>n===2)}
  function isKokushi(){if(melds.length)return false;if(hand.length!==14)return false;const req=isSanma()?['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z']:['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'];const c=counts(hand);return req.every(t=>c[t]>=1)&&req.some(t=>c[t]>=2)}
  function isKokushi13(){if(!isKokushi()||!win)return false;const req=isSanma()?['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z']:['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'];const c=counts(hand);return req.every(t=>c[t]===1 || (t===win&&c[t]===2))}

  function fixedGroups(){return melds.map(m=>m.tiles.slice())}
  function shapeData(d){return {groups:[...fixedGroups(),...(d?.groups||[])],pair:d?.pair||null}}
  function groupList(s){return s.groups}
  function allShapeTiles(s){return [...s.groups.flatMap(g=>g),...(s.pair||[])];}
  function hasTrip(s,t){return s.groups.some(g=>isTrip(g)&&g[0]===t)}
  function hasSeq(s,key){return s.groups.some(g=>isSeq(g)&&groupKey(g)===key)}
  function yakuList(d){
    const chiitoi=isChiitoi();
    const s=shapeData(d);
    const all=(chiitoi && (!d || ((!d.groups||d.groups.length===0) && !d.pair))) ? sortedTiles(hand) : allShapeTiles(s);
    const gs=s.groups, seqs=gs.filter(isSeq), trips=gs.filter(isTrip), kans=melds.filter(m=>m.type.includes('kan'));
    const open=!closed(), r=[];
    const add=(name,han,type='normal')=>r.push({name,han,type});

    // 和了条件系
    if(el('doubleRiichi').checked && closed()) add('ダブル立直',2);
    else if(el('riichi').checked && closed()) add('立直',1);
    if(el('ippatsu').checked && (el('riichi').checked||el('doubleRiichi').checked) && closed()) add('一発',1);
    if(el('winMethod').value==='tsumo' && closed()) add('門前清自摸和',1);
    if(el('rinshan').checked && el('winMethod').value==='tsumo') add('嶺上開花',1);
    if(el('chankan').checked && el('winMethod').value==='ron') add('槍槓',1);
    if(el('haitei').checked && el('winMethod').value==='tsumo') add('海底摸月',1);
    if(el('houtei').checked && el('winMethod').value==='ron') add('河底撈魚',1);
    if(el('tenhou').checked && el('winMethod').value==='tsumo' && el('dealer').value==='true' && closed()) add('天和',13,'yakuman');
    if(el('chiihou').checked && el('winMethod').value==='tsumo' && el('dealer').value==='false' && closed()) add('地和',13,'yakuman');

    // 役満は最優先で判定する。ただし複数役満が同時成立する場合は役満同士のみ残す。
    if(isKokushi()){
      add(isKokushi13()&&rules.doubleYakuman?'国士無双十三面待ち':'国士無双',isKokushi13()&&rules.doubleYakuman?26:13,'yakuman');
      return r;
    }

    // 七対子は通常形とは別形だが、断么九・混一色・清一色・混老頭などは複合可能。
    if(chiitoi) add('七対子',2);

    const pair=s.pair?.[0];
    const valued=pair && (isDragon(pair)||pair===el('seat').value||pair===el('round').value);

    // 断么九
    if(all.length && all.every(isSimple) && (!open || rules.openTanyao)) add('断么九',1);

    if(!chiitoi){
      // 平和
      if(closed() && seqs.length===4 && !valued && waitTypes(d).includes('ryanmen')) add('平和',1);

      // 一盃口 / 二盃口
      if(closed()){
        const seqKeys=seqs.map(groupKey), freq={};
        seqKeys.forEach(k=>freq[k]=(freq[k]||0)+1);
        const pairs=Object.values(freq).filter(x=>x>=2).length;
        if(pairs>=2) add('二盃口',3);
        else if(pairs>=1) add('一盃口',1);
      }

      // 役牌。三元牌・自風・場風は別々の1翻として加算する。
      trips.forEach(g=>{
        const t=g[0];
        if(isDragon(t)) add('役牌',1);
        if(t===el('seat').value) add('自風牌',1);
        if(t===el('round').value) add('場風牌',1);
      });

      // 対々和
      if(trips.length===4) add('対々和',2);

      // 三暗刻。ロンで和了した刻子のうち、和了牌を含むものは明刻扱い。
      let concealedTriplets=0;
      gs.forEach(g=>{
        if(!isTrip(g)) return;
        const fixed=melds.find(m=>groupKey(m.tiles)===groupKey(g));
        if(fixed){if(fixed.type==='ankan') concealedTriplets++;return;}
        if(el('winMethod').value==='ron' && win && g.includes(win)) return;
        concealedTriplets++;
      });
      if(concealedTriplets>=3) add('三暗刻',2);

      if(kans.length>=3) add('三槓子',2);

      // 三色同順・一気通貫・三色同刻
      const seqBy=(n,ss)=>seqs.some(g=>g[0]===`${n}${ss}`);
      for(let n=1;n<=7;n++){
        if(SUITS.every(ss=>seqBy(n,ss))){add('三色同順',open?1:2);break;}
      }
      for(const ss of SUITS){
        if([1,4,7].every(n=>seqBy(n,ss))){add('一気通貫',open?1:2);break;}
      }
      for(let n=1;n<=9;n++){
        if(SUITS.every(ss=>trips.some(g=>g[0]===`${n}${ss}`))){add('三色同刻',2);break;}
      }

      // 混全帯么九・純全帯么九
      const pairHasTO=!!pair && isTerminalOrHonor(pair);
      const allHaveTO=gs.length===4 && gs.every(g=>g.some(isTerminalOrHonor));
      const hasSeq=seqs.length>0;
      if(pairHasTO && allHaveTO && hasSeq){
        if(all.every(t=>!isHonor(t))) add('純全帯么九',open?2:3);
        else add('混全帯么九',open?1:2);
      }

      // 小三元
      const dragonTrips=['5z','6z','7z'].filter(t=>hasTrip(s,t)).length;
      const dragonPair=!!pair && isDragon(pair);
      if(dragonTrips===2 && dragonPair) add('小三元',2);

      // 混老頭 / 清老頭 / 字一色
      if(all.length && all.every(isTerminalOrHonor) && gs.length===4 && gs.every(isTrip)){
        if(all.every(isTerminal)) add('清老頭',13,'yakuman');
        else if(all.every(isHonor)) add('字一色',13,'yakuman');
        else add('混老頭',2);
      }
    } else {
      // 七対子でも混老頭・清一色・字一色・混一色は複合する。
      if(all.every(isTerminalOrHonor)){
        if(all.every(isTerminal)) add('清老頭',13,'yakuman');
        else if(all.every(isHonor)) add('字一色',13,'yakuman');
        else add('混老頭',2);
      }
    }

    // 大三元・四喜和
    const dragonTrips=['5z','6z','7z'].filter(t=>hasTrip(s,t)).length;
    const dragonPair=!!pair && isDragon(pair);
    if(dragonTrips===3) add('大三元',13,'yakuman');
    const windTrips=['1z','2z','3z','4z'].filter(t=>hasTrip(s,t)).length;
    const windPair=!!pair && isWind(pair);
    if(windTrips===3 && windPair) add('小四喜',13,'yakuman');
    if(windTrips===4) add('大四喜',rules.doubleYakuman?26:13,'yakuman');

    // 四暗刻・四槓子
    if(gs.length===4 && isSuuankou(s)) add('四暗刻'+(isSuuankouTanki(s)?'単騎':''),isSuuankouTanki(s)&&rules.doubleYakuman?26:13,'yakuman');
    if(kans.length===4) add('四槓子',13,'yakuman');

    // 緑一色
    if(all.length && all.every(t=>['2s','3s','4s','6s','8s','6z'].includes(t))) add('緑一色',13,'yakuman');

    // 九蓮宝燈
    if(closed() && all.length===14 && isChuurenShape(all)){
      const pure=isPureChuuren(all,win);
      add(pure&&rules.doubleYakuman?'純正九蓮宝燈':'九蓮宝燈',pure&&rules.doubleYakuman?26:13,'yakuman');
    }

    // 混一色・清一色。七対子にも複合する。
    const suits=unique(all.filter(t=>!isHonor(t)).map(suit));
    const honor=all.some(isHonor);
    if(suits.length===1){
      if(honor) add('混一色',open?2:3);
      else add('清一色',open?5:6);
    }

    // 役満成立時は通常役を上位処理側で非表示にする。
    return r;
  }

  function waitTypes(d){
    if(!d||!win)return [];
    const s=shapeData(d), out=[];
    if(s.pair && s.pair[0]===win) out.push('tanki');
    s.groups.forEach(g=>{
      if(!g.includes(win))return;
      if(isTrip(g)) { out.push('shanpon'); return; }
      if(isSeq(g)){
        const a=num(g[0]), n=num(win);
        if((a===1&&n===3)||(a===7&&n===7)) out.push('penchan');
        else if(n===a+1) out.push('kanchan');
        else out.push('ryanmen');
      }
    });
    return [...new Set(out)];
  }
  function waitType(d){
    const ws=waitTypes(d); return ws.includes('ryanmen')?'ryanmen':(ws[0]||null);
  }

  function isSuuankou(s){
    let n=0; for(const g of s.groups){if(!isTrip(g))continue; const fixed=melds.find(m=>groupKey(m.tiles)===groupKey(g)); if(fixed){if(fixed.type==='ankan')n++;continue;} if(el('winMethod').value==='ron'&&win&&g.includes(win))continue; n++;} return n===4 && closed();
  }
  function isSuuankouTanki(s){return isSuuankou(s)&&s.pair&&s.pair[0]===win}
  function isChuurenShape(all){const suits=unique(all.map(suit));if(suits.length!==1||isHonor(all[0]))return false;const c=counts(all);const ss=suits[0];const req={1:3,2:1,3:1,4:1,5:1,6:1,7:1,8:1,9:3};return Object.keys(req).every(n=>(c[`${n}${ss}`]||0)>=req[n])}
  function isPureChuuren(all,w){if(!w)return false;const c=counts(all),ss=suit(all[0]);const base={1:3,2:1,3:1,4:1,5:1,6:1,7:1,8:1,9:3};return Object.keys(base).every(n=>(c[`${n}${ss}`]||0)===base[n])&&c[w]===base[w]+1;}

  function fuCalc(d){
    if(isChiitoi())return 25;
    const s=shapeData(d); if(!s.pair)return 0; let f=20;
    const wm=el('winMethod').value; if(wm==='ron'&&closed())f+=10;
    if(wm==='tsumo')f+=2;
    s.groups.forEach(g=>{
      if(isSeq(g))return;
      const fixed=melds.find(m=>groupKey(m.tiles)===groupKey(g)); const t=g[0], toh=isTerminalOrHonor(t);
      if(fixed){ if(fixed.type==='ankan')f+=toh?32:16; else if(fixed.type==='minkan'||fixed.type==='shouminkan')f+=toh?16:8; else if(fixed.type==='pon')f+=toh?4:2; }
      else f+=toh?4:2;
    });
    const pair=s.pair[0]; const valued=isDragon(pair)||pair===el('seat').value||pair===el('round').value; if(valued)f+=2; if(rules.doubleWind4&&pair===el('seat').value&&pair===el('round').value)f+=2;
    const wts=waitTypes(d); if(!wts.includes('ryanmen'))f+=2;
    const ys=yakuList(d); if(ys.some(y=>y.name==='平和')&&wm==='tsumo')return 20;
    return Math.ceil(f/10)*10;
  }

  function limitLabel(h){if(h>=13&&rules.kazoe)return'数え役満';if(h>=11)return'三倍満';if(h>=8)return'倍満';if(h>=6)return'跳満';if(h>=5)return'満貫';return''}
  function scoreResult(h,fu,dealer,isRon){return {text:excelScoreResult(h,fu,dealer,isRon)};}
  function formatNum(n){return Number(n).toLocaleString('ja-JP')}
  function aoten(h,fu){return Math.ceil(fu*Math.pow(2,h+2)/100)*100}
  function yakumanMultiplier(ys){return ys.filter(y=>y.type==='yakuman').reduce((a,y)=>a+y.han/13,0)}
  function scoreYakuman(mult,isRon,dealer){const b=8000*mult;if(isRon)return `${formatNum(b*(dealer?6:4))}点`;if(isSanma()){if(dealer){const each=rules.tsumoLoss?b*2/3:b/3;return `${formatNum(round100(each))}点オール`;}return rules.tsumoLoss?`${formatNum(round100(b/4))}-${formatNum(round100(b/2))}点`:`${formatNum(round100(b/3))}-${formatNum(round100(b*2/3))}点`;}return dealer?`${formatNum(b*2)}点オール`:`${formatNum(b)}-${formatNum(b*2)}点`;}

  function renderShape(d){
    const box=el('selectedShape'); box.innerHTML=''; if(!d)return;
    if(isChiitoi() || isKokushi()){
      const b=document.createElement('div'); b.className='shape-group'; b.innerHTML=sortedTiles(hand).map(tileImg).join(''); box.appendChild(b); return;
    }
    const s=shapeData(d);
    s.groups.forEach(g=>{const b=document.createElement('div');b.className='shape-group';b.innerHTML=g.map(tileImg).join('');box.appendChild(b)});
    if(s.pair){const b=document.createElement('div');b.className='shape-group shape-pair';b.innerHTML=s.pair.map(tileImg).join('');box.appendChild(b)}
  }

  function analyze(){
    const st=el('status'); const res=el('yakuResult');res.innerHTML='';el('selectedShape').innerHTML='';el('totalHan').textContent='—';el('totalFu').textContent='—';el('autoScore').textContent='—';
    updateSpecialLabel();
    const kanCount=melds.filter(m=>m.type==='ankan'||m.type==='minkan'||m.type==='shouminkan').length;
    const physical=hand.length+melds.reduce((a,m)=>a+m.tiles.length,0);
    const expected=14+kanCount;
    if(physical!==expected){st.className='status';st.textContent=`現在${physical}枚。手牌と副露を合わせて${expected}枚にしてね`;return}
    if(!win){st.className='status';st.textContent='和了牌を選択してね';return}
    if(tileCount(win)<1){st.className='status err';st.textContent='和了牌が手牌にありません';return}
    if(isKokushi()||isChiitoi()){
      const d={groups:[],pair:null}; const ys=yakuList(d); const ym=yakumanMultiplier(ys); finish(d,ys,ym); return;
    }
    const need=4-melds.length;if(need<0){st.className='status err';st.textContent='副露数が多すぎます';return}
    const ds=decompositions(hand,need);let best=null;
    ds.forEach(d=>{
      const ys=yakuList(d), ym=yakumanMultiplier(ys);
      const h=ys.filter(y=>y.type!=='yakuman').reduce((a,y)=>a+y.han,0)+doraCount();
      const fu=fuCalc(d), valid=ys.length>0;
      if(!valid)return;
      const key={d,ys,ym,h,fu};
      if(!best || ym>best.ym || (ym===best.ym && (h>best.h || (h===best.h && fu>best.fu)))) best=key;
    });
    if(!best){st.className='status err';st.textContent='役が成立していないか、牌姿を分解できません';return}
    finish(best.d,best.ys,best.ym,best);
  }
  function finish(d,ys,ym,best){
    const st=el('status');
    const yakuman=ym>=1;
    const displayYs=yakuman ? ys.filter(y=>y.type==='yakuman') : ys;
    const doraH=doraCount();
    const h=(best?best.h:displayYs.filter(y=>y.type!=='yakuman').reduce((a,y)=>a+y.han,0)+doraH);
    const fu=best?best.fu:25;
    st.className='status ok';
    st.textContent=yakuman?`${ym===2?'ダブル':ym>2?ym+'倍':''}役満判定`:'判定完了';
    renderShape(d);
    el('yakuResult').innerHTML=displayYs.map(y=>`<div class="yaku"><span>${y.name}</span><b>${y.type==='yakuman'?(y.han===26?'ダブル役満':'役満'):`${y.han}飜`}</b></div>`).join('') + (doraH&&!yakuman?`<div class="yaku"><span>ドラ（赤・裏を含む）</span><b>${doraH}飜</b></div>`:'');
    el('totalHan').textContent=yakuman?`${ym===1?'役満':ym+'倍役満'}`: `${h}飜`;
    el('totalFu').textContent=yakuman?'—':`${fu}符`;
    const dealer=el('dealer').value==='true', ron=el('winMethod').value==='ron';
    el('autoScore').textContent=yakuman?scoreYakuman(ym,ron,dealer):(limitLabel(h)?`${limitLabel(h)}：${scoreResult(h,fu,dealer,ron).text}`:scoreResult(h,fu,dealer,ron).text);
  }

  // Yaku score restriction and settings sync
  function syncRuleEffects(){if(!rules.redDora)red.clear();}

  // Score table
  function tableCell(h,fu,dealer,isRon){
    if(h>=13) return rules.kazoe?'数え役満':'三倍満';
    if(h===11) return '三倍満';
    if(h===8) return '倍満';
    if(h===6) return '跳満';
    if(h===5) return '満貫';
    const raw=scoreRaw(h,fu,dealer);
    if(raw >= (dealer?12000:8000)) return '満貫';
    return scoreResult(h,fu,dealer,isRon).text;
  }
  const SANMA_NO_LOSS_NORMAL={
    child:{
      20:[null,{ron:null,tsumo:'600/900'},{ron:2600,tsumo:'1100/1700'},{ron:5200,tsumo:'2000/3300'}],
      25:[null,{ron:null,tsumo:null},{ron:1600,tsumo:null},{ron:3200,tsumo:'1200/2000'},{ron:6400,tsumo:'2400/4000'}],
      30:[null,{ron:1000,tsumo:'500/700'},{ron:2000,tsumo:'800/1300'},{ron:3900,tsumo:'1500/2500'},null],
      40:[null,{ron:1300,tsumo:'600/900'},{ron:2600,tsumo:'1100/1700'},{ron:5200,tsumo:'2000/3300'},null],
      50:[null,{ron:1600,tsumo:'600/1000'},{ron:3200,tsumo:'1200/2000'},{ron:6400,tsumo:'2400/4000'},null],
      60:[null,{ron:2000,tsumo:'800/1300'},{ron:3900,tsumo:'1500/2500'},null,null],
      70:[null,{ron:2300,tsumo:'900/1500'},{ron:4500,tsumo:'1800/2900'},null,null],
      80:[null,{ron:2600,tsumo:'1100/1700'},{ron:5200,tsumo:'2000/3300'},null,null],
      90:[null,{ron:2900,tsumo:'1200/1900'},{ron:5800,tsumo:'2300/3700'},null,null],
      100:[null,{ron:3200,tsumo:'1200/2000'},{ron:6400,tsumo:'2400/4000'},null,null],
      110:[null,null,{ron:7100,tsumo:'2700/4500'},null,null]
    },
    parent:{
      20:[null,{ron:null,tsumo:'1100オール'},{ron:3900,tsumo:'2000オール'},{ron:7700,tsumo:'3900オール'}],
      25:[null,{ron:null,tsumo:null},{ron:2400,tsumo:null},{ron:4800,tsumo:'2400オール'},{ron:9600,tsumo:'4800オール'}],
      30:[null,{ron:1500,tsumo:'800オール'},{ron:2900,tsumo:'1500オール'},{ron:5800,tsumo:'3000オール'},null],
      40:[null,{ron:2000,tsumo:'1100オール'},{ron:3900,tsumo:'2000オール'},{ron:7700,tsumo:'3900オール'},null],
      50:[null,{ron:2400,tsumo:'1200オール'},{ron:4800,tsumo:'2400オール'},{ron:9600,tsumo:'4800オール'},null],
      60:[null,{ron:2900,tsumo:'1500オール'},{ron:5800,tsumo:'3000オール'},null,null],
      70:[null,{ron:3400,tsumo:'1800オール'},{ron:6800,tsumo:'3500オール'},null,null],
      80:[null,{ron:3900,tsumo:'2000オール'},{ron:7700,tsumo:'3900オール'},null,null],
      90:[null,{ron:4400,tsumo:'2300オール'},{ron:8700,tsumo:'4400オール'},null,null],
      100:[null,{ron:4800,tsumo:'2400オール'},{ron:9600,tsumo:'4800オール'},null,null],
      110:[null,null,{ron:10600,tsumo:'5400オール'},null,null]
    }
  };
  const SANMA_NO_LOSS_LIMIT={
    child:[['満貫',8000,'3000/5000'],['跳満',12000,'4500/7500'],['倍満',16000,'6000/10000'],['三倍満',24000,'9000/15000'],['役満',32000,'12000/20000']],
    parent:[['満貫',12000,'6000オール'],['跳満',18000,'9000オール'],['倍満',24000,'12000オール'],['三倍満',36000,'18000オール'],['役満',48000,'24000オール']]
  };
  function renderScoreTable(){
    const wrap=el('scoreTableWrap');wrap.innerHTML='';
    const dealer=scorePlayer==='parent';
    if(isSanma() && !rules.tsumoLoss){
      if(scoreRange==='limit'){
        let html='<table class="score-table limit-table"><thead><tr><th>段階</th><th>ロン</th><th>ツモ</th></tr></thead><tbody>';
        SANMA_NO_LOSS_LIMIT[dealer?'parent':'child'].forEach(([name,ron,ts])=>{html+=`<tr><th class="limit-name">${name}</th><td><span class="ron">${formatScorePart(ron)}点</span></td><td><span class="tsumo">${ts}点</span></td></tr>`});
        html+='</tbody></table>';wrap.innerHTML=html;return;
      }
      const data=SANMA_NO_LOSS_NORMAL[dealer?'parent':'child'], fus=[20,25,30,40,50,60,70,80,90,100,110], hans=[1,2,3,4];
      let html='<table class="score-table"><thead><tr><th>符 ＼ 飜</th>'+hans.map(h=>`<th>${h}飜</th>`).join('')+'</tr></thead><tbody>';
      fus.forEach(f=>{html+=`<tr><th>${f}符</th>`;hans.forEach(h=>{
        const cell=data[f]?.[h]??null;
        if(!cell) html+='<td><span class="ron">—</span><span class="tsumo">—</span></td>';
        else html+=`<td><span class="ron">${cell.ron==null?'—':formatScorePart(cell.ron)}</span><span class="tsumo">${cell.tsumo==null?'—':cell.tsumo}</span></td>`;
      });html+='</tr>'});
      html+='</tbody></table>';wrap.innerHTML=html;return;
    }
    if(scoreRange==='limit'){
      const rows=[['満貫',5],['跳満',6],['倍満',8],['三倍満',11],['数え役満',13]];
      let html='<table class="score-table limit-table"><thead><tr><th>段階</th><th>ロン</th><th>ツモ</th></tr></thead><tbody>';
      rows.forEach(([name,h])=>{if(h===13&&!rules.kazoe)return;html+=`<tr><th class="limit-name">${name}</th><td>${scoreResult(h,30,dealer,true).text}</td><td>${scoreResult(h,30,dealer,false).text}</td></tr>`});
      html+=`<tr class="cap"><th>役満</th><td>${scoreYakuman(1,true,dealer)}</td><td>${scoreYakuman(1,false,dealer)}</td></tr></tbody></table>`;
      wrap.innerHTML=html;return;
    }
    const fus=[20,25,30,40,50,60,70,80,90,100,110], hans=[1,2,3,4];
    let html='<table class="score-table"><thead><tr><th>符 ＼ 飜</th>'+hans.map(h=>`<th>${h}飜</th>`).join('')+'</tr></thead><tbody>';
    fus.forEach(f=>{html+=`<tr><th>${f}符</th>`;hans.forEach(h=>{
      const noRon=(f===20)||(f===25&&h===1); const noTsumo=(f===20&&h<2)||(f===25&&h<3);
      if(noRon && noTsumo)html+='<td><span class="ron">—</span><span class="tsumo">—</span></td>';
      else if(noRon){const ts=tableCell(h,f,dealer,false);html+=`<td><span class="ron">—</span><span class="tsumo">${ts}</span></td>`;}
      else if(noTsumo){const r=tableCell(h,f,dealer,true);html+=`<td><span class="ron">${r}</span><span class="tsumo">—</span></td>`;}
      else {const r=tableCell(h,f,dealer,true),ts=tableCell(h,f,dealer,false);html+=`<td><span class="ron">${r}</span><span class="tsumo">${ts}</span></td>`;}
    });html+='</tr>'});html+='</tbody></table>';wrap.innerHTML=html;
  }

  document.querySelectorAll('[data-score-player]').forEach(b=>b.onclick=()=>{scorePlayer=b.dataset.scorePlayer;document.querySelectorAll('[data-score-player]').forEach(x=>x.classList.toggle('active',x===b));renderScoreTable()});
  document.querySelectorAll('[data-score-range]').forEach(b=>b.onclick=()=>{scoreRange=b.dataset.scoreRange;document.querySelectorAll('[data-score-range]').forEach(x=>x.classList.toggle('active',x===b));renderScoreTable()});

  const YAKU_READINGS={
    'ダブル立直':'だぶるりーち','一気通貫':'いっきつうかん','一盃口':'いーぺーこー','一発':'いっぱつ','海底摸月':'はいていもーゆえ','河底撈魚':'ほうていろうゆい','九蓮宝燈':'ちゅーれんぽーとー','国士無双':'こくしむそう','混一色':'ほんいつ','混全帯么九':'ほんちゃんたいやおちゅー','混老頭':'ほんろーとー','三暗刻':'さんあんこー','三色同刻':'さんしょくどうこう','三色同順':'さんしょくどうじゅん','三槓子':'さんかんつ','四暗刻':'すーあんこー','四槓子':'すーかんつ','字一色':'つーいーそー','七対子':'ちーといつ','純全帯么九':'じゅんちゃんたいやおちゅー','小三元':'しょうさんげん','小四喜':'しょうすーしー','清一色':'ちんいつ','清老頭':'ちんろーとー','槍槓':'ちゃんかん','対々和':'といといほー','大三元':'だいさんげん','大四喜':'だいすーしー','断么九':'たんやお','地和':'ちーほー','天和':'てんほー','二盃口':'りゃんぺーこー','平和':'ぴんふ','門前清自摸和':'めんぜんちんつもほー','役牌':'やくはい','立直':'りーち','緑一色':'りゅーいーそー','嶺上開花':'りんしゃんかいほー','中張牌':'ちゅうちゃんぱい'};
  const yakuCollator=new Intl.Collator('ja',{usage:'sort',sensitivity:'base'});
  function renderYakuTable(){
    const mode=el('yakuSort').value;
    const arr=clone(yakuCatalog).sort((a,b)=>mode==='han'?(a.han-b.han)||((a.freq??Infinity)-(b.freq??Infinity)):mode==='frequency'?((b.freq??-1)-(a.freq??-1)):yakuCollator.compare(YAKU_READINGS[a.name]||a.name,YAKU_READINGS[b.name]||b.name));
    el('yakuTableBody').innerHTML=arr.map(y=>{
      const closedV=y.han>=26?'2倍役満':y.han>=13?'役満':`${y.han}飜`;
      let openV='門前のみ';
      if(y.han<13 && typeof y.open==='number'){
        openV = y.open===y.han ? `鳴きOK（食い下がりなし）` : `喰い下がり${y.open}飜`;
      } else if(y.han>=13){
        openV = y.open==='門前のみ' ? '門前のみ'
              : y.open==='鳴きOK' ? '鳴きOK'
              : '役満';
      }
      const freq=y.freq==null?'—':(()=>{
        if(y.freq===0)return '0.0000%';
        let digits=y.freq<0.1?4:2;
        while(Number(y.freq.toFixed(digits))===0 && digits<10)digits++;
        return `${y.freq.toFixed(digits)}%`;
      })();
      return `<tr><td><strong>${y.name}</strong></td><td>${closedV}</td><td>${openV}</td><td>${freq}</td></tr>`;
    }).join('');
  }
  el('yakuSort').onchange=renderYakuTable;

  // prevent contradictory manual choices
  function syncManualConflicts(){
    const a=el('m_agari').value,s=el('m_special').value;
    [...el('m_special').options].forEach(o=>o.disabled=false);
    [...el('m_agari').options].forEach(o=>o.disabled=false);
    if(a==='ツモ') [...el('m_special').options].find(o=>o.value==='門前ロン')?.setAttribute('disabled','disabled');
    if(a==='ロン') [...el('m_special').options].find(o=>o.value==='平和ツモ')?.setAttribute('disabled','disabled');
    if(s==='門前ロン')el('m_agari').value='ロン';
    if(s==='平和ツモ')el('m_agari').value='ツモ';
  }
  el('m_agari').addEventListener('change',syncManualConflicts); el('m_special').addEventListener('change',syncManualConflicts);

  // Initial setup
  updateRuleSummary();loadSettingsUI();syncPlayerModeUI();syncRuleEffects();updateSpecialLabel();syncManualConflicts();renderHand();renderWin();renderMelds();renderWaitHand();renderWaitResult();manualCalc();analyze();
  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=19').catch(()=>{}));}
})();
