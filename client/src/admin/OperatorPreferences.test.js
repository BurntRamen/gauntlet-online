import {act,render} from '@testing-library/react';
import {OperatorPreferences,useOperatorPreferences} from './OperatorPreferences';
let operator;
function Harness(){operator=useOperatorPreferences();return null;}
beforeEach(()=>{localStorage.clear();sessionStorage.clear();});
test('preferences reset and never transfer private recent work to another account',()=>{
 const scope='simply@local';const first=render(<OperatorPreferences scope={scope}><Harness/></OperatorPreferences>);
 act(()=>operator.remember({domain:'sets',id:'private-set',name:'Private set'}));act(()=>operator.update({density:'compact'}));
 first.unmount();const resumed=render(<OperatorPreferences scope={scope}><Harness/></OperatorPreferences>);
 expect(operator.preferences.recent[0].id).toBe('private-set');expect(operator.preferences.density).toBe('compact');
 act(()=>operator.reset());expect(operator.preferences.recent).toEqual([]);expect(operator.preferences.density).toBe('comfortable');
 resumed.unmount();render(<OperatorPreferences scope='Burnt Ramen@other-environment'><Harness/></OperatorPreferences>);
 expect(operator.preferences.recent).toEqual([]);expect(localStorage.getItem('gauntlet-admin:'+scope)).toBeNull();
});
test('retired planning-task state is not revived from old preferences',()=>{
 localStorage.setItem('gauntlet-admin:simply@local',JSON.stringify({version:1,task:{id:'set',root:'old-private-set'}}));
 render(<OperatorPreferences scope='simply@local'><Harness/></OperatorPreferences>);expect(operator.preferences).not.toHaveProperty('task');
});
