from pathlib import Path

path = Path('react-migration/src/pages/PerformancePage.jsx')
text = path.read_text(encoding='utf-8')

old_import = '  RefreshCw,\n'
if old_import not in text:
    raise SystemExit('No se encontró el import RefreshCw esperado')
text = text.replace(old_import, '', 1)

old_block = '''        <div className="perf-header-actions">
          <button type="button" className="perf-refresh" onClick={() => void loadData({ silent: true })}><RefreshCw size={16} /> Actualizar</button>
          {isStaff ? <button type="button" className="perf-new" onClick={() => { setError(''); setFormOpen(true); }}><Plus size={17} /> Nuevo test</button> : null}
        </div>'''
new_block = '''        {isStaff ? (
          <div className="perf-header-actions">
            <button type="button" className="perf-new" onClick={() => { setError(''); setFormOpen(true); }}><Plus size={17} /> Nuevo test</button>
          </div>
        ) : null}'''

if old_block not in text:
    raise SystemExit('No se encontró el bloque de acciones esperado')
text = text.replace(old_block, new_block, 1)
path.write_text(text, encoding='utf-8')
