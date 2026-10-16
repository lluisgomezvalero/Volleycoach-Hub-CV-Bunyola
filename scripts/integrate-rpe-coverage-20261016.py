from pathlib import Path
p=Path('assets/index-insights-20261012.js');s=p.read_text()
assert './rpe-coverage-20261016.js' not in s
s='import {rpeCoverage,coverageCopy} from "./rpe-coverage-20261016.js";\n'+s
def replace(old,new):
 global s
 assert s.count(old)==1,(old[:100],s.count(old));s=s.replace(old,new,1)
# Existing data sources, same seven-day load window. No additional database writes.
s=s.replace('.select("id,starts_at,ends_at,payload")','.select("id,status,starts_at,ends_at,payload")').replace('.select("id,starts_at,ends_at,title,payload")','.select("id,status,starts_at,ends_at,title,payload")')
replace('player:et,...ba.get(et.id)||{seven:0,twentyEight:0},latestRpe:Ct','player:et,...ba.get(et.id)||{seven:0,twentyEight:0},coverage:rpeCoverage(ga,individualAttendance.data||[],Pn.data||[],et.id,wl,Fe.getTime()),latestRpe:Ct')
replace('historyCoverageDays:et,ready:gn,label:Gs,text:aa','historyCoverageDays:et,ready:gn,label:Gs,text:aa,coverage:rpeCoverage(Hn,Qt.data||[],dn.data||[],a.player.id,wl,Fe.getTime())')
# No-events branch also gets an explicit descriptive state.
replace('V(Pn)}if(!be)return;', 'if(!Pn.coverage)Pn.coverage=rpeCoverage(Hn,[],[],a.player.id,wl,Fe.getTime());V(Pn)}if(!be)return;')
replace('Ie.forEach(je=>{je.chronicWeek=', 'Ie.forEach((je,coveragePlayerId)=>{je.coverage=rpeCoverage(E,O,D,coveragePlayerId,yN,se);je.chronicWeek=')
# Coverage labels below existing numbers/sections; keep the current layout.
replace('children:[be.twentyEight," UA · 28 días"]})]}),i.jsx("td",{children:i.jsx("span",{className:`coach-load-state ${We.key}`,children:We.label})', 'children:[be.twentyEight," UA · 28 días"]}),i.jsx(RpeCoverage,{coverage:be.coverage,compact:true})]}),i.jsx("td",{children:i.jsx("span",{className:`coach-load-state ${be.coverage?.incomplete?"learning":We.key}`,children:be.coverage?.incomplete?"Datos incompletos":We.label})')
replace('children:ae.label}),i.jsx("p",{children:ae.text})','children:ae.coverage?.incomplete?"Carga registrada incompleta":ae.label}),i.jsx("p",{children:ae.coverage?.incomplete?"Faltan registros para interpretar esta semana. Revisa el detalle de abajo.":ae.text})')
replace('className:"player-week-evolution",children:[i.jsx("h4",{children:"Tu evolución reciente"})','className:"player-week-evolution",children:[i.jsx("h4",{children:"Tu evolución reciente"}),i.jsx(RpeCoverage,{coverage:ae.coverage})')
replace('children:[Math.round(ue.seven)," UA"]})','children:[Math.round(ue.seven)," UA",i.jsx(RpeCoverage,{coverage:ue.coverage,compact:true})]})')
replace('className:`wellness-load-status wellness-load-${Be.load.state.key}`','className:`wellness-load-status wellness-load-${Be.load.coverage?.incomplete?"neutral":Be.load.state.key}`')
replace('children:Be.load.state.label}),i.jsx("span",{children:Be.load.ready?', 'children:Be.load.coverage?.incomplete?"Carga registrada incompleta":Be.load.state.label}),i.jsx("span",{children:Be.load.ready?')
# Insert between the existing load grid and its explanatory status.
replace(']}),i.jsxs("div",{className:`wellness-load-status wellness-load-${Be.load.coverage', ']}),i.jsx(RpeCoverage,{coverage:Be.load.coverage}),i.jsxs("div",{className:`wellness-load-status wellness-load-${Be.load.coverage')
replace('children:Te.title}),i.jsx("span",{children:Te.text})', 'children:st?.coverage?.incomplete?"Carga registrada incompleta":Te.title}),i.jsx("span",{children:st?.coverage?.incomplete?"Faltan registros para interpretar la carga de estos días.":Te.text})')
replace('className:`wellness-player-trend-pill wellness-player-trend-${Te.key}`','className:`wellness-player-trend-pill wellness-player-trend-${st?.coverage?.incomplete?"neutral":Te.key}`')
replace('i.jsx("strong",{children:Te.title})]})]}),i.jsxs("section",{className:"wellness-card",children:', 'i.jsx("strong",{children:st?.coverage?.incomplete?"Carga registrada incompleta":Te.title})]}),i.jsx(RpeCoverage,{coverage:st?.coverage})]}),i.jsxs("section",{className:"wellness-card",children:')
s+='''\nfunction RpeCoverage({coverage,compact=false}){const copy=coverageCopy(coverage);if(!copy)return null;return i.jsxs("span",{className:`rpe-coverage${compact?" compact":""}`,children:[i.jsx("span",{children:copy.summary}),copy.warning?i.jsx("strong",{children:copy.warning}):null,copy.details?i.jsx("span",{children:copy.details}):null]})}\n'''
p.write_text(s)
p=Path('index.html');s=p.read_text();s=s.replace('</head>','<link rel="stylesheet" href="./assets/rpe-coverage-20261016.css">\n</head>');p.write_text(s)
p=Path('service-worker.js');s=p.read_text().replace('20261015-individual-minutes-v1','20261016-rpe-coverage-v1');p.write_text(s)
