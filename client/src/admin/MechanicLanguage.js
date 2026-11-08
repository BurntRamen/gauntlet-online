import { useHelp } from "./AuthoringHelp";
export default function MechanicLanguage({ studio }) {
  const helpCopy = useHelp();
  return <details><summary>{helpCopy.languageCopy1}</summary><dl>{studio?.vocabulary?.map(term => <div key={term.word}><dt>{term.word}</dt><dd>{term.meaning}</dd></div>)}</dl><p>{helpCopy.languageCopy2}</p></details>;
}
