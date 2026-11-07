import { createContext, useContext } from "react";

const Values = createContext(null);
export function EditorValues({ children, ...value }) {
  return <Values.Provider value={value}>{children}</Values.Provider>;
}

/** Clone only the edited path. Undefined removes an optional contract property. */
export function updateAt(value, [key, ...path], next) {
  const updated = Array.isArray(value) ? [...value] : { ...value };
  if (path.length) updated[key] = updateAt(value[key], path, next);
  else if (next === undefined) delete updated[key];
  else updated[key] = next;
  return updated;
}

/** Native controls share conversion and immutable leaf edits across draft editors. */
export default function ValueControl({ label, options, onChange, path, type = "text", number = false, empty = "", optional = false, children, ...props }) {
  const editor = useContext(Values);
  const checkbox = type === "checkbox";
  const current = path?.reduce((value, key) => value?.[key], editor?.value);
  const controlProps = { disabled: editor?.disabled, ...(path ? checkbox ? { checked: !!current } : { value: current ?? "" } : {}), ...props };
  const change = event => {
    const value = event.target.value;
    const next = checkbox ? event.target.checked : value === "" ? optional ? undefined : empty : number || type === "number" ? Number(value) : value;
    if (onChange) onChange(next);
    else editor.onChange(updateAt(editor.value, path, next));
  };
  const control = options ? <select {...controlProps} onChange={change}>{options.map((option, index) => {
    const [value, text] = Array.isArray(option) ? option : [option, option];
    return <option key={index} value={value}>{text}</option>;
  })}</select> : <input {...controlProps} type={type} onChange={change} />;
  return label == null ? control : <label>{checkbox ? control : label}{checkbox ? label : control}{children}</label>;
}

export const replaceAt = (items, index, value) => items.map((item, i) => i === index ? value : item);
export const removeAt = (items, index) => items.filter((_, i) => i !== index);
export function moveUp(items, index) {
  const next = [...items];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next;
}
export const toggleValue = (items = [], value, checked) => checked ? [...items, value] : items.filter(item => item !== value);
