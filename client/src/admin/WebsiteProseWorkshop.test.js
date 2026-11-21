import {fireEvent,render,screen,within} from '@testing-library/react';
import WebsiteProseWorkshop from './WebsiteProseWorkshop';
import presentation from '../../../shared/websitePresentation';
const state={guide:require("../../../server/adminAuthoringGuide"),live:{domains:{game:[{id:'practice',name:'Practice',playPageTitle:'Saved heading'}],campaigns:[],factions:[]}},fields:{game:{practice:{name:{},description:{},heroTitle:{},playPageTitle:{defaultValue:'Play'},playPageDescription:{defaultValue:'Pick a match.'},playPageLayout:{type:'website-layout',defaultValue:presentation.defaultLayout('play')},websiteNavigation:{type:'website-navigation',defaultValue:presentation.defaultNavigation()}}}}};
const props={state,field:()=>null,target:{id:'practice',section:'play'},onTarget:jest.fn(),context:{},onContext:jest.fn()};
test('page selection renders the actual player page and follows the guarded target callback',async()=>{
 const field=jest.fn(key=><p key={key}>Edit {key}</p>),onTarget=jest.fn();
 render(<WebsiteProseWorkshop {...props} field={field} onTarget={onTarget}/>);
 expect(await screen.findByRole('heading',{name:'Saved heading'},{timeout:10000})).toBeInTheDocument();
 expect(document.querySelector('[data-layout-module="basic-ai"]')).toBeInTheDocument();
 expect(field.mock.calls.slice(0,3).map(c=>c[0])).toEqual(['playPageTitle','playPageDescription','playPageImage']);
 fireEvent.click(screen.getByRole('button',{name:/Learn & Rules landing/}));
 expect(onTarget).toHaveBeenCalledWith({domain:'modes',id:'practice',section:'learn'});
});
test('selecting an actual page component opens its presentation controls',async()=>{
 const field=jest.fn(key=><p key={key}>{key}</p>);
 render(<WebsiteProseWorkshop {...props} field={field}/>);
 const preview=await screen.findByRole('region',{name:'Website presentation preview'});
 fireEvent.click((await within(preview).findAllByRole('button',{name:'Basic vs AI',exact:true}))[0]);
 expect(screen.getByLabelText('Edit element')).toHaveValue('basic-ai');
 expect(document.querySelector('[data-layout-module="basic-ai"]')).toHaveAttribute('data-studio-selected');
 fireEvent.change(screen.getByLabelText('Edit element'),{target:{value:'navigation'}});
 expect(document.querySelector('.website-render .cd-rail nav')).toHaveAttribute('data-studio-selected');
 expect(document.querySelector('[data-layout-module="basic-ai"]')).not.toHaveAttribute('data-studio-selected');
 fireEvent.change(screen.getByLabelText('Edit element'),{target:{value:'basic-ai'}});
 expect(field).toHaveBeenLastCalledWith('playPageLayout',{domain:'game',row:state.live.domains.game[0]});
});
test('local heading, immutable imagery and composition render together without mutating the saved snapshot',async()=>{
 const layout=presentation.defaultLayout('play');layout.arrangement='list';layout.typography='editorial';layout.sections[0].visible=false;layout.sections.reverse();
 render(<WebsiteProseWorkshop {...props} state={{...state,assetLibrary:[{id:'one',path:'/assets/header.webp'}]}} buffers={{'game:practice:playPageTitle':'Local heading','game:practice:playPageImage':'one','game:practice:playPageLayout':JSON.stringify(layout)}}/>);
 expect(await screen.findByRole('heading',{name:'Local heading'})).toBeInTheDocument();
 expect(document.querySelector('.cd-page-artwork')).toHaveAttribute('src','/assets/header.webp');
 expect(document.querySelector('[data-layout-module="basic-ai"]')).toBeNull();
 expect(document.querySelector('.cd-shell')).toHaveAttribute('data-arrangement','list');
 expect(document.querySelector('.cd-shell')).toHaveAttribute('data-typography','editorial');
 expect(state.live.domains.game[0].playPageTitle).toBe('Saved heading');
});
test('a missing local image never falls back to previously published artwork',async()=>{
 render(<WebsiteProseWorkshop {...props} state={{...state,previewContent:{manifest:{websiteProse:{play:{image:'/assets/old.webp'}}}}}} buffers={{'game:practice:playPageImage':'missing'}}/>);
 await screen.findByRole('heading',{name:'Saved heading'},{timeout:10000});
 expect(document.querySelector('.cd-page-artwork')).toBeNull();
});
test('search links open the exact surface and mode copy remains accessible',()=>{
 const view=render(<WebsiteProseWorkshop {...props} target={{id:'practice',field:'settingsPageTitle'}} field={key=><p key={key}>{key}</p>}/>);
 expect(screen.getByRole('heading',{level:3,name:'Settings page header'})).toBeInTheDocument();
 expect(screen.getByText('settingsPageTitle')).toBeInTheDocument();
 view.rerender(<WebsiteProseWorkshop {...props} target={{id:'practice',section:'mode-practice'}} field={key=><p key={key}>{key}</p>}/>);
 expect(screen.getByText('name')).toBeInTheDocument();
 expect(screen.queryByText('websiteNavigation')).toBeNull();
});

test("mode prose search targets reveal their exact editable field",()=>{
 render(<WebsiteProseWorkshop {...props} target={{id:"practice",field:"heroTitle"}} field={key=><p key={key}>{key}</p>}/>);
 expect(screen.getByText("heroTitle")).toBeInTheDocument();
 expect(screen.queryByText("playPageTitle")).not.toBeInTheDocument();
});
