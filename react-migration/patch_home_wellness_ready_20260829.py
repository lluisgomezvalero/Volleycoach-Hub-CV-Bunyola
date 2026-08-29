from pathlib import Path

path = Path('react-migration/src/pages/HomePage.jsx')
text = path.read_text()

old = "  const [wellness, setWellness] = useState([]);\n  const [workloadRows, setWorkloadRows] = useState([]);"
new = "  const [wellness, setWellness] = useState([]);\n  const [playerWellnessLoaded, setPlayerWellnessLoaded] = useState(false);\n  const [workloadRows, setWorkloadRows] = useState([]);"
if old not in text:
    raise SystemExit('Wellness state block not found')
text = text.replace(old, new, 1)

old = """      if (!team?.id) {
        setLoading(false);
        return;
      }

      const cachedHomeEvents = readHomeEventsCache(team.id);"""
new = """      if (!team?.id) {
        setLoading(false);
        return;
      }

      setPlayerWellnessLoaded(isStaff || !identity?.player?.id);

      const cachedHomeEvents = readHomeEventsCache(team.id);"""
if old not in text:
    raise SystemExit('Dashboard start block not found')
text = text.replace(old, new, 1)

old = """        setPlayers(nextPlayers);
        setWellness(nextWellness);
        setWorkloadRows(nextWorkloads);"""
new = """        setPlayers(nextPlayers);
        setWellness(nextWellness);
        setPlayerWellnessLoaded(true);
        setWorkloadRows(nextWorkloads);"""
if old not in text:
    raise SystemExit('Dashboard state commit block not found')
text = text.replace(old, new, 1)

old = "{!isStaff && !loading && !playerWellnessToday ? ("
new = "{!isStaff && !loading && playerWellnessLoaded && !playerWellnessToday ? ("
if old not in text:
    raise SystemExit('Daily wellness banner condition not found')
text = text.replace(old, new, 1)

path.write_text(text)
print('Home daily wellness waits for real wellness state')
