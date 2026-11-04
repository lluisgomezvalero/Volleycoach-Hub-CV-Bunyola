import {test} from 'node:test';import assert from 'node:assert/strict';
import {showPushActivationReminder,createPushActivationReminder} from '../assets/push-activation-reminder-20261104.js';
const gemma='4d4c0486-9c35-4455-98f1-06e82066fbf3';
test('only the requested account is reminded, and enabled notifications never ask again',()=>{
 for(const status of ['available','denied','unsupported','ios-install']){assert.equal(showPushActivationReminder(gemma,status),true);assert.equal(showPushActivationReminder('another-profile',status),false);assert.equal(showPushActivationReminder(gemma,status,true),false);}
 for(const status of ['checking','enabled','hidden','foreign'])assert.equal(showPushActivationReminder(gemma,status),false);
});
test('activation requires a click; blocked permission uses recheck instead',()=>{
 let activated=0,rechecked=0;const jsx={jsx:(type,props)=>({type,props})},Card=createPushActivationReminder(jsx),props={onActivate:()=>activated++,onRecheck:()=>rechecked++};
 const available=Card({...props,status:'available'});assert.equal(activated,0);available.props.children.at(-1).props.onClick();assert.equal(activated,1);
 const denied=Card({...props,status:'denied'});denied.props.children.at(-1).props.onClick();assert.equal(activated,1);assert.equal(rechecked,1);assert.ok(JSON.stringify(denied).includes('bloqueadas'));
});
