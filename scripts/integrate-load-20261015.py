from pathlib import Path
p=Path('assets/index-insights-20261012.js');s=p.read_text()
# This repository contains the deployed bundle, not its original React source.
# Keep edits bounded and assert anchors so future bundles cannot be patched silently.
def call_end(text,start):
    pos=text.index('(',start);depth=0;quote=None;escaped=False
    for n in range(pos,len(text)):
        c=text[n]
        if quote:
            if escaped:escaped=False
            elif c=='\\':escaped=True
            elif c==quote:quote=None
            continue
        if c in ('"',"'",'`'):quote=c;continue
        if c=='(':depth+=1
        elif c==')':
            depth-=1
            if depth==0:return n+1
    raise ValueError('Unclosed call')
if "./load-ui-20261015.js" in s:raise SystemExit('Already integrated')
s='import {LoadPanel,LoadWellness} from "./load-ui-20261015.js";\nimport {scheduledMinutes,rpeWindow,dayKey,madridInstant} from "./load-model-20261015.js";\n'+s
# The same component and data path on Home and the full wellness/load route.
start=s.index('c?i.jsxs("article",{className:"coach-card coach-load-card"')
aend=call_end(s,start+2);assert s[aend]==':'
bend=call_end(s,aend+1)
s=s[:start]+'i.jsx(LoadPanel,{identity:a,db:Q,React:_,jsx:i,compact:true})'+s[bend:]
start=s.index('function _N(');end=s.index('const wN=',start)
s=s[:start]+'function _N(){const{identity:a}=an();return i.jsx(LoadPanel,{identity:a,db:Q,React:_,jsx:i})}'+s[end:]
# Retain the home check-in trigger, but use the same brief form as the full page.
start=s.index('ie&&!c?i.jsx("div",{className:"player-checkin-backdrop"')
end=call_end(s,start+len('ie&&!c?'))
s=s[:start]+'''ie&&!c?i.jsx("div",{className:"load-dialog-backdrop",children:i.jsx("section",{className:"load-dialog",role:"dialog","aria-modal":true,"aria-label":"Bienestar de hoy",children:i.jsx(LoadWellness,{React:_,jsx:i,db:Q,playerId:a.player.id,onSaved:entry=>{ge(old=>[entry,...old.filter(row=>row.entry_date!==entry.entry_date)]);ve(false)},onClose:()=>ve(false)})})})'''+s[end:]
# Duration display has no fabricated default. Confirmed individual minutes live in the new ledger.
for fn in ['wl','pr','yN']:
 start=s.index('function '+fn+'(');end=s.index('function ',start+10)
 s=s[:start]+f'function {fn}(a){{return scheduledMinutes(a)}}'+s[end:]
# Existing roll-call now accepts individual minutes for present and late, including early departures.
s=s.replace('if(Ie==="late"){const je=Number(Ae.minutes);','if(["present","late"].includes(Ie)&&Ae.minutes!==""&&Ae.minutes!=null){const je=Number(Ae.minutes);',1)
s=s.replace('if(je>I)throw new Error(`${Tl(ue)} no puede superar ${I} min.`);','if(je>1440)throw new Error("Revisa los minutos individuales.");',1)
s=s.replace('ce.status==="late"?i.jsxs("label",{className:"late-minutes"','["present","late"].includes(ce.status)?i.jsxs("label",{className:"late-minutes"',1)
s=s.replace('min:"1",max:pr(le.event),value:ce.minutes','min:"1",max:1440,value:ce.minutes',1)
s=s.replace('children:["de ",pr(le.event)," min"]','children:["Programados: ",pr(le.event)??"por confirmar"," min · incluye pausas habituales. Vacío = pendiente."]',1)
# Consistent RPE window, including Madrid midnight and existing reopening overrides.
s=s.replace('N=Number.isFinite(b)&&!S&&g>=b,','N=rpeWindow(a,g),',1)
start=s.index('function WE(');end=s.index('function ',start+10)
s=s[:start]+'function WE(a){const next=new Date(Date.parse(dayKey(a.starts_at)+"T12:00:00Z")+86400000).toISOString().slice(0,10);return Date.parse(madridInstant(next,"00:00"))-1}'+s[end:]
# Replace date-based pending reminder checks with the shared rule.
s=s.replace('!Vn&&Fe.getTime()<qa+1800*1e3','!Vn&&!rpeWindow(De,Fe.getTime())')
s=s.replace('fs.setHours(23,59,59,999)','fs.setTime(WE(De))')
# Missing duration must not become a session ending at its start.
s=s.replace('return Number.isFinite(s)?s+pr(a)*60*1e3:Number.NaN','return Number.isFinite(s)&&pr(a)>0?s+pr(a)*60*1e3:Number.NaN')
# Title is shared by desktop and mobile navigation.
s=s.replace('["/wellness","Bienestar",mn]','["/wellness","Carga y bienestar",mn]')
p.write_text(s)
p=Path('index.html');s=p.read_text().replace('</head>','<link rel="stylesheet" href="./assets/load-20261015.css">\n</head>');p.write_text(s)
p=Path('service-worker.js');s=p.read_text();import re
s=re.sub(r"const CACHE_VERSION = '[^']+';","const CACHE_VERSION = '20261015-load-monitoring-v1';",s);p.write_text(s)
