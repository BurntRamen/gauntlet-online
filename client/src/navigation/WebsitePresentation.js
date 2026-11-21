import {createContext, useContext} from 'react';
export const WebsitePresentationContext = createContext(null);
export const useWebsitePresentation = () => useContext(WebsitePresentationContext);
