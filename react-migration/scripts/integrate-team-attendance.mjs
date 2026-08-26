import fs from 'node:fs';

const file = new URL('../src/pages/TrainingPage.jsx', import.meta.url);
let source = fs.readFileSync(file, 'utf8');

if (source.includes("import TeamAttendancePanel from './TeamAttendancePanel.jsx';")) {
  console.log('Team attendance is already integrated.');
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not locate ${label}`);
  source = source.replace(search, replacement);
}

replaceOnce(
  '  Users,\n  X',
  '  Users,\n  UsersRound,\n  X',
  'Users icon import'
);

replaceOnce(
  "import { supabase } from '../lib/supabase.js';\nimport './TrainingPage.css';",
  "import { supabase } from '../lib/supabase.js';\nimport TeamAttendancePanel from './TeamAttendancePanel.jsx';\nimport './TrainingPage.css';",
  'TeamAttendancePanel import location'
);

const tabPattern = /            <button className=\{tab === 'upcoming'[\s\S]*?<\/button>\n            <button className=\{tab === 'history'[\s\S]*?<\/button>/;
if (!tabPattern.test(source)) throw new Error('Could not locate training tab buttons');
source = source.replace(tabPattern, `            <button className={tab === 'upcoming' ? 'active' : ''} type="button" onClick={() => setTab('upcoming')}><Sparkles size={16} /> Próxima sesión <span>{upcoming.length}</span></button>
            <button className={tab === 'history' ? 'active' : ''} type="button" onClick={() => setTab('history')}><CalendarDays size={16} /> Completados <span>{history.length}</span></button>
            {isStaff ? <button className={tab === 'attendance' ? 'active' : ''} type="button" onClick={() => setTab('attendance')}><UsersRound size={16} /> Asistencia del equipo</button> : null}`);

replaceOnce(
  "      {!loading && !error ? (\n        <>\n          {tab === 'upcoming' && nextSession ? (",
  "      {!loading && !error ? (\n        <>\n          {tab === 'attendance' && isStaff ? <TeamAttendancePanel teamId={teamId} events={events} /> : null}\n          {tab !== 'attendance' ? <>\n          {tab === 'upcoming' && nextSession ? (",
  'main training content opening'
);

replaceOnce(
  "            {!shown.length ? <div className=\"training-empty\">No hay entrenamientos en esta vista.</div> : null}\n          </section>\n        </>\n      ) : null}",
  "            {!shown.length ? <div className=\"training-empty\">No hay entrenamientos en esta vista.</div> : null}\n          </section>\n          </> : null}\n        </>\n      ) : null}",
  'main training content closing'
);

fs.writeFileSync(file, source);
console.log('Integrated team attendance into TrainingPage.jsx');
