import { createContext, useContext } from "react";
// Capability guidance comes from the same private server projection as the
// authoring contracts, so operators see the deployed backend's constraints.
const Topics = createContext({});
export function HelpProvider({ value, children }) { return <Topics.Provider value={value || {}}>{children}</Topics.Provider>; }
export default function Help({ topic, ...props }) {
  const text = useContext(Topics)[topic];
  return text ? <p {...props}>{text}</p> : null;
}
