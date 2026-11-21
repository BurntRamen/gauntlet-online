import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import Recovery,{ArchiveActions} from './Recovery';
import {Facts,Json} from './Presentation';
const State=({state,children})=>state.data?children(state.data):null;
const overview={activePlay:{rooms:[],draftQueues:{}},collector:{}};
test('recovery previews the exact archive before explicit hash-bound import and refreshes after commitment',async()=>{
  const record={matchId:'match-one',recordVersion:2},request=jest.fn(async(path,options)=>path.endsWith('/overview')?overview:path.endsWith('/preview')?{sha256:'verified-hash',byteSize:80,preview:{participants:[]}}:{status:'imported'});
  render(<Recovery request={request} State={State} Facts={Facts} Json={Json} date={()=>'date'}/>);
  fireEvent.change(screen.getByLabelText('Select JSON'),{target:{files:[{text:async()=>JSON.stringify(record)}]}});
  fireEvent.click(await screen.findByRole('button',{name:'Commit Import'}));
  await waitFor(()=>expect(request).toHaveBeenCalledWith('/api/admin/match-archive/import/commit',{method:'POST',body:JSON.stringify({record,expectedSha256:'verified-hash'})}));
  expect(await screen.findByRole('status')).toHaveTextContent('Archive imported.');
  expect(request.mock.calls.filter(([path])=>path.endsWith('/overview'))).toHaveLength(2);
});
test('the match inspection surface keeps canonical download, integrity verification and exports together',async()=>{
  const request=jest.fn(async()=>({sha256:'verified-hash'}));render(<ArchiveActions request={request} id="match-one" verified environment="https://api.example.test"/>);
  fireEvent.click(screen.getByRole('button',{name:'Download JSON'}));await screen.findByText('Canonical archive downloaded.');
  expect(request).toHaveBeenCalledWith('/api/matches/match-one/archive',{download:'gauntlet-match-match-one.json'});
  fireEvent.click(screen.getByRole('button',{name:'Verify Integrity'}));await screen.findByText('Verified · SHA verified-hash');
  expect(request).toHaveBeenCalledWith('/api/admin/match-archive/match-one/verify',{method:'POST',body:'{}'});
  expect(screen.getByRole('link',{name:'Para Export'})).toHaveAttribute('href','https://api.example.test/api/matches/match-one/export/para?version=2');
});
