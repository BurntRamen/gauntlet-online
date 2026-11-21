import {render,screen,fireEvent} from '@testing-library/react';
import WorkshopShell from './WorkshopShell';
import {HelpProvider} from './AuthoringHelp';
import {EditorSessionContext} from './EditorSession';
const help=require('../../../server/adminAuthoringGuide').help;
const renderJourney=(journey={},props={})=>render(<HelpProvider value={help}><EditorSessionContext.Provider value={{target:{domain:'cards'},journey}}><WorkshopShell name="Card Workshop" title="Card" selectionId="card" sections={[["identity","Details"],["artwork","Artwork"]]} section="identity" {...props}>{props.children || <input aria-label="Name"/>}</WorkshopShell></EditorSessionContext.Provider></HelpProvider>);
test('next section opens the actual editor without implying completed work',()=>{
 const onSection=jest.fn();renderJourney({}, {onSection});
 expect(screen.getByRole('button',{name:'Details'})).toHaveAttribute('aria-current','step');
 expect(screen.getByLabelText('Your next step')).toHaveTextContent('Make it yours');
 fireEvent.click(screen.getByRole('button',{name:'Continue to Artwork'}));expect(onSection).toHaveBeenCalledWith('artwork');
});
test('the record save bar owns guidance while local record edits exist',()=>{
 renderJourney({dirty:true,saveShown:true});expect(screen.queryByLabelText('Your next step')).not.toBeInTheDocument();
});
test('an untested saved revision stays on Test and qualified evidence leads to review',()=>{
 const review=jest.fn();HTMLElement.prototype.scrollIntoView=jest.fn();
 const props={section:'test',sections:[['test','Test'],['related','Related content']],children:<section id="workshop-test"><select aria-label="Test source"><option>Saved draft</option></select></section>};
 const view=renderJourney({draft:true,tested:false,review},props);
 expect(screen.queryByRole('button',{name:'Continue to Related content'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Go to test controls'}));expect(screen.getByLabelText('Test source')).toHaveFocus();
 view.unmount();renderJourney({draft:true,tested:true,review},props);
 fireEvent.click(screen.getByRole('button',{name:'Review saved changes'}));expect(review).toHaveBeenCalledTimes(1);
});
test('conflicts never suggest continuing or reviewing',()=>{
 renderJourney({blocked:true,dirty:true});expect(screen.getByLabelText('Your next step')).toHaveTextContent('Resolve this before continuing');
 expect(screen.queryByRole('button',{name:/Continue to|Review saved/})).not.toBeInTheDocument();
});
test('saved validation issues link directly to their owning field',()=>{
 const fix=jest.fn();renderJourney({draft:true,issue:{message:'Choose a valid name'},fix});
 expect(screen.getByLabelText('Your next step')).toHaveTextContent('Choose a valid name');fireEvent.click(screen.getByRole('button',{name:'Fix this field'}));expect(fix).toHaveBeenCalledTimes(1);
});
test('a saved final section leads to shared review, with no claim it is live',()=>{
 const review=jest.fn();renderJourney({draft:true,review},{section:'artwork',onSection:jest.fn()});
 expect(screen.getByLabelText('Your next step')).toHaveTextContent('Shared draft available');fireEvent.click(screen.getByRole('button',{name:'Review saved changes'}));expect(review).toHaveBeenCalledTimes(1);
});
test.each(['submit',undefined])('registry guidance focuses a %s save control without submitting',type=>{
 const save=jest.fn();HTMLElement.prototype.scrollIntoView=jest.fn();
 renderJourney({dirty:true},{sections:null,children:<form onSubmit={save}><button type={type}>Save definition</button></form>});
 fireEvent.click(screen.getByRole('button',{name:'Go to save controls'}));expect(screen.getByRole('button',{name:'Save definition'})).toHaveFocus();expect(save).not.toHaveBeenCalled();
});
