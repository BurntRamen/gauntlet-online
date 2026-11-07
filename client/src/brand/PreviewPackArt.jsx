import { lazy, Suspense } from "react";
import "./PreviewPackArt.css";

const Artwork = lazy(() => import(/* webpackChunkName: "suitfire-art-preview" */ "./PreviewPackArtwork"));
export default function PreviewPackArt(props) {
  return <Suspense fallback={<span className="preview-pack-art" role="status" aria-label="Loading pack artwork" />}><Artwork {...props} /></Suspense>;
}
