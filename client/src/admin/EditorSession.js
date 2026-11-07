import { createContext, useContext, useEffect, useRef } from "react";

export const EditorSessionContext = createContext(null);

// Structured editors keep ownership of their buffers and validation. The shell
// receives an explicit save/discard contract, never arbitrary form values to save.
export function useEditorSession({ dirty, label, save, discard, local, saved }) {
  const context = useContext(EditorSessionContext), current = useRef(null);
  current.current = { save, discard };
  const register = context?.register;
  useEffect(() => {
    if (!register) return undefined;
    register(dirty ? { label, local, saved, save: () => current.current.save(), discard: () => current.current.discard?.() } : null);
    return () => register(null);
  }, [register, dirty, label, local, saved]);
  return action => context ? context.requestLeave(action) : !dirty || window.confirm("Discard unsaved definition changes?") ? action() : false;
}
