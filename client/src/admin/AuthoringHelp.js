import { createContext, useContext } from "react";
import operatorCopy from "./operatorCopy.json";
// Capability guidance comes from the same private server projection as the
// authoring contracts, so operators see the deployed backend's constraints.
// Local labels explain the UI; server-provided capabilities and limits stay authoritative.
const Topics = createContext(operatorCopy);
export function HelpProvider({ value, children }) { return <Topics.Provider value={{ ...value, ...operatorCopy }}>{children}</Topics.Provider>; }
export function useHelp() { return useContext(Topics); }
export default function Help({ topic, ...props }) {
  const text = useContext(Topics)[topic];
  return text ? <p {...props}>{text}</p> : null;
}
