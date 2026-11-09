import { useEffect, useState } from "react";

export default function useAdminData(request, path, revision, enabled = true) {
  const [state, setState] = useState(null);
  const key = `${path}:${revision}`;
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState(null);
    request(path).then(data => { if (active) setState({ key, loading: false, data, error: "" }); }, error => { if (active) setState({ key, loading: false, data: null, error: error.message }); });
    return () => { active = false; };
  }, [request, path, key, enabled]);
  return enabled && state?.key === key ? state : { loading: true, data: null, error: "" };
}
