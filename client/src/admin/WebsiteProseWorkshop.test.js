import {render} from "./testSupport";
import {fireEvent,screen,within} from "@testing-library/react";
import {useState} from "react";
import WebsiteControls from "./WebsiteControls";
import WebsiteProseWorkshop from './WebsiteProseWorkshop';
import presentation from '../../../shared/websitePresentation';
const state={guide:require("../../../server/adminAuthoringGuide"),live:{domains:{game:[{id:'practice',name:'Practice',playPageTitle:'Saved heading'}],campaigns:[],factions:[]}},fields:{game:{practice:{...require('../../../server/websiteProse').proseFields('practice'),name:{},description:{},heroTitle:{},playPageTitle:{defaultValue:'Play'},playPageDescription:{defaultValue:'Pick a match.'},playPageLayout:{type:'website-layout',defaultValue:presentation.defaultLayout('play')},websiteNavigation:{type:'website-navigation',defaultValue:presentation.defaultNavigation()}}}}};
beforeEach(()=>{global.ResizeObserver=class{observe(){} disconnect(){}};});
const frameDoc=()=>screen.getByTitle('Desktop player page preview').contentDocument;
const player=async()=>{const frame=await screen.findByTitle('Desktop player page preview',{}, {timeout:10000});fireEvent.load(frame);return within(frame.contentDocument.body);};
const props={state,field:()=>null,target:{id:'practice',section:'play'},onTarget:jest.fn(),context:{},onContext:jest.fn()};
test('page selection renders the actual player page and follows the guarded target callback',async()=>{
 const field=jest.fn(key=><p key={key}>Edit {key}</p>),onTarget=jest.fn();
 render(<WebsiteProseWorkshop {...props} field={field} onTarget={onTarget}/>);
 const preview=await player();
 const main=preview.getByRole('main',{name:'Representative player page'});
 expect(await within(main).findByRole('heading',{name:'Saved heading'},{timeout:10000})).toBeInTheDocument();
 expect(preview.getAllByRole('main')).toHaveLength(1);
 expect(frameDoc().querySelector('[data-layout-module="basic-ai"]')).toBeInTheDocument();
 expect(field.mock.calls.slice(0,3).map(c=>c[0])).toEqual(['playPageTitle','playPageDescription','playPageImage']);
 fireEvent.click(screen.getByRole('button',{name:/Learn & Rules landing/}));
 expect(onTarget).toHaveBeenCalledWith({domain:'modes',id:'practice',section:'learn'});
});
test('selecting an actual page component opens its presentation controls',async()=>{
 const field=jest.fn(key=><p key={key}>{key}</p>);
 render(<WebsiteProseWorkshop {...props} field={field}/>);
 const preview=await player();
 await preview.findByRole('heading',{name:'Saved heading'});
 const tile=frameDoc().querySelector('[data-layout-module="basic-ai"]');
 fireEvent.click(within(tile).getByRole('button',{name:'Basic vs AI',exact:true}));
 expect(screen.getByLabelText('Edit element')).toHaveValue('basic-ai');
 expect(frameDoc().querySelector('[data-layout-module="basic-ai"]')).toHaveAttribute('data-studio-selected');
 fireEvent.change(screen.getByLabelText('Edit element'),{target:{value:'navigation'}});
 expect(frameDoc().querySelector('.cd-rail nav')).toHaveAttribute('data-studio-selected');
 expect(frameDoc().querySelector('[data-layout-module="basic-ai"]')).not.toHaveAttribute('data-studio-selected');
 fireEvent.change(screen.getByLabelText('Edit element'),{target:{value:'basic-ai'}});
 expect(field).toHaveBeenLastCalledWith('playPageTile-basic-ai-Icon',{domain:'game',row:state.live.domains.game[0]});
});
test('local heading, immutable imagery and composition render together without mutating the saved snapshot',async()=>{
 const layout=presentation.defaultLayout('play');layout.arrangement='list';layout.typography='editorial';layout.sections[0].visible=false;layout.sections.reverse();
 render(<WebsiteProseWorkshop {...props} state={{...state,assetLibrary:[{id:'one',path:'/assets/header.webp'}]}} buffers={{'game:practice:playPageTitle':'Local heading','game:practice:playPageImage':'one','game:practice:playPageLayout':JSON.stringify(layout)}}/>);
 expect(await (await player()).findByRole('heading',{name:'Local heading'})).toBeInTheDocument();
 expect(frameDoc().querySelector('.cd-page-artwork')).toHaveAttribute('src','/assets/header.webp');
 expect(frameDoc().querySelector('[data-layout-module="basic-ai"]')).toBeNull();
 expect(frameDoc().querySelector('.cd-shell')).toHaveAttribute('data-arrangement','list');
 expect(frameDoc().querySelector('.cd-shell')).toHaveAttribute('data-typography','editorial');
 expect(state.live.domains.game[0].playPageTitle).toBe('Saved heading');
});
test('a missing local image never falls back to previously published artwork',async()=>{
 render(<WebsiteProseWorkshop {...props} state={{...state,previewContent:{manifest:{websiteProse:{play:{image:'/assets/old.webp'}}}}}} buffers={{'game:practice:playPageImage':'missing'}}/>);
 await (await player()).findByRole('heading',{name:'Saved heading'},{timeout:10000});
 expect(frameDoc().querySelector('.cd-page-artwork')).toBeNull();
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

test("an operator can save a theme, change the layout, and reapply the named template",()=>{
 const definition={page:"play",type:"website-layout",defaultValue:presentation.defaultLayout("play")};
 function Editor(){const [value,update]=useState(definition.defaultValue);return <WebsiteControls definition={definition} value={value} state={state} onChange={update}/>;}
 render(<Editor/>);
 fireEvent.change(screen.getByLabelText("Theme"),{target:{value:"midnight"}});
 fireEvent.change(screen.getByLabelText("Tile width"),{target:{value:"412"}});
 fireEvent.change(screen.getByLabelText("Template name"),{target:{value:"Tournament"}});
 fireEvent.click(screen.getByRole("button",{name:"Save template"}));
 fireEvent.change(screen.getByLabelText("Tile width"),{target:{value:"180"}});
 fireEvent.change(screen.getByLabelText("Saved templates"),{target:{value:"playPageLayout/Tournament"}});
 fireEvent.click(screen.getByRole("button",{name:"Apply template"}));
 expect(screen.getByLabelText("Tile width")).toHaveValue("412");
 expect(screen.getByLabelText("Theme")).toHaveValue("midnight");
});

test('Soundtrack opens a recording with title, replacement, download and published distribution',()=>{
 const field=jest.fn(key=><p key={key}>{key}</p>);
 render(<WebsiteProseWorkshop {...props} field={field} target={{id:'practice',section:'soundtrack'}}/>);
 fireEvent.change(screen.getByLabelText('Playlist recording'),{target:{value:'music_rumin_2'}});
 expect(screen.getByText('music_rumin_2Title')).toBeInTheDocument();
 expect(screen.getByText('music_rumin_2Audio')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Download recording'})).toHaveAttribute('href',expect.stringContaining('rumin-civic-imperium-v2.mp3'));
 expect(screen.getByRole('link',{name:'Open published recording to share'})).toHaveAttribute('href',expect.stringContaining('rumin-civic-imperium-v2.mp3'));
});
