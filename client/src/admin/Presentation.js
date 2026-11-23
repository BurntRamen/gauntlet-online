import { useState } from "react";

export const label = value => String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, char => char.toUpperCase());
export function Facts({values,className='admin-facts'}) {
  return <dl className={className}>{Object.entries(values).map(([key,value])=><div key={key}><dt>{label(key)}</dt><dd>{value==null?'Not recorded':typeof value==='boolean'?(value?'Yes':'No'):value}</dd></div>)}</dl>;
}
export function Json({value,title='Inspect source projection',className='admin-json',preClassName}) {
  const [open, setOpen] = useState(false);
  return <details className={className} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{title}</summary>
    {open && <pre className={preClassName}>{JSON.stringify(value, null, 2)}</pre>}
  </details>;
}
export function resolveCard(manifest,id,printingId,suit='spades') {
  const card=manifest?.cards?.find(row=>row.id===id), printing=manifest?.collectorVariants?.find(row=>row.variantId===(printingId||card?.defaultVariantId));
  return card && (!printingId||printing) ? {...card,suit,...(printing?{variantId:printing.variantId,collector:printing,presentation:printing.presentation||card.presentation}:{})} : null;
}
