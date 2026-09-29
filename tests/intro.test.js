import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('learning steps are consolidated into the catalog introduction',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const intro=html.match(/<section class="intro">[\s\S]*?<\/section>/)[0];
 for(const text of ['한 번에 하나씩 바꿔 보세요.','기본 응답 관찰','목표 또는 이득 변경','외란 후 회복 비교']) assert.ok(intro.includes(text),text);
 assert.doesNotMatch(html,/class="learning-note"|A SIMPLE WAY TO EXPLORE/);
});
