import { useEffect, useRef } from "react";
import { streamUrl } from "../api/client";

/**
 * Subscribe to the incident SSE stream for an organization and invoke a
 * callback on each update. Reconnects automatically via EventSource.
 */
export function useIncidentStream(organizationId: string | undefined, onUpdate: () => void) {
  const cb = useRef(onUpdate);
  cb.current = onUpdate;

  useEffect(() => {
    if (!organizationId) return;
    const es = new EventSource(streamUrl(organizationId));
    es.onmessage = () => cb.current();
    es.onerror = () => {
      /* EventSource retries on its own; ignore transient errors */
    };
    return () => es.close();
  }, [organizationId]);
}
