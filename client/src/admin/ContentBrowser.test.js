import {render} from "./testSupport";
import {screen,fireEvent} from "@testing-library/react";
import {BrowserControls,filterContent} from './ContentBrowser';
const rows=[{id:'one',name:'Dawn blade',factionId:'rumin',type:'armament',rarity:'rare'},{id:'two',name:'Dawn guard',factionId:'rumin',type:'ally',rarity:'rare',status:'archived'},{id:'three',name:'Dawn blade',factionId:'sheen',type:'armament',rarity:'common'}];
const snapshot={domains:{factions:[],sets:[{id:'set-a',name:'First set',members:['one','two']}]}};
test('card filters intersect authoritative set membership, identity and availability',()=>{
 const filters={query:'dawn',set:'set-a',faction:'rumin',type:'armament',rarity:'rare',status:'active'};
 expect(filterContent(rows,'cards',filters,snapshot).map(row=>row.id)).toEqual(['one']);
 expect(filterContent(rows,'cards',{...filters,set:'deleted-set'},snapshot)).toEqual([]);
 expect(filterContent(rows,'cards',{status:'archived'},snapshot).map(row=>row.id)).toEqual(['two']);
 const change=jest.fn(),query=jest.fn();render(<BrowserControls domain="cards" label="cards" rows={rows} snapshot={snapshot} query="dawn" filters={filters} onFilters={change} onQuery={query}/>);
 fireEvent.change(screen.getByLabelText('Filter cards by set'),{target:{value:''}});expect(change).toHaveBeenCalledWith({set:''});
 fireEvent.click(screen.getByText('Clear filters'));expect(query).toHaveBeenCalledWith('');
 expect(Object.values(change.mock.calls.at(-1)[0]).every(value=>value==='')).toBe(true);
});
