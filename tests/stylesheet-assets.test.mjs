import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const html=readFileSync('index.html','utf8');
test('every local stylesheet in the deployed HTML resolves to an existing nonempty CSS file',()=>{
 const links=[...html.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]).filter(tag=>/rel=["']stylesheet["']/.test(tag));assert.ok(links.length>5);
 for(const tag of links){const href=tag.match(/href=["']([^"']+)/)[1];if(/^https?:/.test(href))continue;const path=resolve(href.split('?')[0].replace(/^\.\//,'').replace(/^\//,''));assert.ok(existsSync(path),`Missing stylesheet: ${href}`);assert.ok(readFileSync(path,'utf8').length>0);}
});
test('Japos presentation and single-row mobile navigation load from the exact real stylesheet',()=>{
 assert.ok(html.includes('./assets/japos-20261019.css?v=style-20261020-fix1'));const css=readFileSync('assets/japos-20261019.css','utf8');assert.ok(css.includes('.bottom-nav.bottom-nav-japos{grid-template-columns:repeat(6,minmax(0,1fr))}'));assert.ok(css.includes('.japo-hero{'));assert.ok(css.includes('.japo-empty-cup svg{width:60px;height:60px;'));
});
