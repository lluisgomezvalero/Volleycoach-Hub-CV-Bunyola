from pathlib import Path
source=Path('assets/index-save-feedback-20261001.js')
s=source.read_text()
def replace(old,new):
 global s
 assert s.count(old)==1,(old[:100],s.count(old))
 s=s.replace(old,new)
replace('opponent_logo_file:null}}function uN','opponent_logo_file:null,match_venue:"home"}}function uN')
replace('opponent_logo_file:null}}function dN','opponent_logo_file:null,match_venue:matchVenue(a)}}function dN')
replace('St={...st,type:Wh(te.type),time:te.time','St={...st,match_venue:Be?matchVenue(te):null,type:Wh(te.type),time:te.time')
replace('p?i.jsxs("span",{className:"calendar-match-visual","aria-label":`${g.ownName} contra ${g.opponentName}`,children:[i.jsx(fv,{src:g.ownLogo,name:g.ownName}),i.jsx("b",{children:"VS"}),i.jsx(fv,{src:g.opponentLogo,name:g.opponentName})]})','p?i.jsx(MatchVenueVisual,{event:a,matchup:g})')
anchor='y?i.jsxs("div",{className:"calendar-opponent-picker",children:['
replace(anchor,anchor+'''i.jsxs("label",{className:"calendar-match-venue-field",children:[i.jsx("span",{children:"Jugamos como"}),i.jsxs("select",{value:matchVenue(l),onChange:w=>c(S=>({...S,match_venue:w.target.value})),children:[i.jsx("option",{value:"home",children:"Local"}),i.jsx("option",{value:"away",children:"Visitante"})]})]}),i.jsx(MatchVenuePreview,{form:l,leagueTeams:s}),''')
replace('function hN({event:a,isStaff:t,onClose:s,onEdit:l,onDelete:c})','function hN({event:a,isStaff:t,onClose:s,onEdit:l,onDelete:c,leagueTeams:leagueTeams=[]})')
anchor='a.location?i.jsxs("div",{className:"calendar-detail-row"'
replace(anchor,'''["match","friendly","tournament"].includes(u)?i.jsxs("div",{className:"calendar-detail-match",children:[i.jsx(MatchVenueVisual,{event:a,matchup:lN(a,leagueTeams)}),i.jsx("strong",{children:matchVenue(a)==="away"?"Visitante":"Local"})]}):null,'''+anchor)
replace('i.jsx(hN,{event:Y,isStaff:l,','i.jsx(hN,{event:Y,leagueTeams:E,isStaff:l,')
old='i.jsxs("div",{className:"coach-match-main",children:[i.jsxs("div",{className:"coach-team-mark",children:[i.jsx("span",{children:i.jsx("img",{src:sv,alt:""})}),i.jsx("strong",{children:"CV Bunyola"})]}),i.jsx("div",{className:"coach-match-vs",children:"VS"}),i.jsxs("div",{className:"coach-team-mark",children:[i.jsx("span",{children:i.jsx(HE,{name:Ie,src:fe})}),i.jsx("strong",{children:Ie})]})]})'
replace(old,'i.jsx(MatchVenueHome,{event:Ae,ownLogo:sv,opponentName:Ie,opponentLogo:fe})')
s+='''
// Local/away selection is stored in the existing event JSON payload.
function matchVenue(eventOrForm) {
  return (eventOrForm?.payload?.match_venue ?? eventOrForm?.match_venue)==="away" ? "away" : "home";
}
function orderedMatchTeams(event,matchup) {
  const own={name:matchup.ownName,logo:matchup.ownLogo};
  const opponent={name:matchup.opponentName,logo:matchup.opponentLogo};
  return matchVenue(event)==="away" ? [opponent,own] : [own,opponent];
}
function MatchVenueVisual({event,matchup}) {
  const [home,away]=orderedMatchTeams(event,matchup);
  return i.jsxs("span",{className:"calendar-match-visual","aria-label":`${home.name} contra ${away.name}`,children:[i.jsx(fv,{src:home.logo,name:home.name}),i.jsx("b",{children:"VS"}),i.jsx(fv,{src:away.logo,name:away.name})]});
}
function MatchVenuePreview({form,leagueTeams}) {
  const event={team_id:form.team_id,payload:form};
  const [home,away]=orderedMatchTeams(event,lN(event,leagueTeams));
  return i.jsxs("div",{className:"calendar-match-venue-preview",children:[
    i.jsxs("div",{children:[i.jsx(fv,{src:home.logo,name:home.name}),i.jsx("strong",{children:home.name}),i.jsx("small",{children:"Local"})]}),
    i.jsx("b",{children:"VS"}),
    i.jsxs("div",{children:[i.jsx(fv,{src:away.logo,name:away.name}),i.jsx("strong",{children:away.name}),i.jsx("small",{children:"Visitante"})]})
  ]});
}
function MatchVenueHome({event,ownLogo,opponentName,opponentLogo}) {
  const [home,away]=orderedMatchTeams(event,{ownName:"CV Bunyola",ownLogo,opponentName,opponentLogo});
  return i.jsxs("div",{className:"coach-match-main","aria-label":`${home.name} contra ${away.name}`,children:[
    i.jsxs("div",{className:"coach-team-mark",children:[i.jsx("span",{children:i.jsx(HE,{name:home.name,src:home.logo})}),i.jsx("strong",{children:home.name})]}),
    i.jsx("div",{className:"coach-match-vs",children:"VS"}),
    i.jsxs("div",{className:"coach-team-mark",children:[i.jsx("span",{children:i.jsx(HE,{name:away.name,src:away.logo})}),i.jsx("strong",{children:away.name})]})
  ]});
}
'''
Path('assets/index-match-venue-20261001.js').write_text(s)
Path('assets/index-NTH10f-r.js').write_text('export * from "./index-match-venue-20261001.js";\n')
p=Path('index.html');html=p.read_text().replace('index-save-feedback-20261001.js','index-match-venue-20261001.js')
if 'match-venue-20261001.css' not in html:
 html=html.replace('</head>','  <link rel="stylesheet" href="./assets/match-venue-20261001.css">\n  </head>')
p.write_text(html)
p=Path('service-worker.js');p.write_text(p.read_text().replace('20261001-save-feedback-v3','20261001-match-venue-v4'))
Path('assets/match-venue-20261001.css').write_text('''
.calendar-match-venue-field{margin-bottom:12px;}
.calendar-match-venue-preview{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px;padding:14px;border:1px solid #e2e8f0;border-radius:14px;margin:8px 0 16px;background:#f8fafc;}
.calendar-match-venue-preview>div{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;min-width:0;}
.calendar-match-venue-preview strong{font-size:14px;overflow-wrap:anywhere;}
.calendar-match-venue-preview small{color:#64748b;font-size:12px;}
.calendar-match-venue-preview .calendar-match-logo{width:44px;height:44px;}
.calendar-detail-match{display:flex;align-items:center;gap:14px;margin:16px 0;}
''')
