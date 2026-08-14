import { useEffect, useRef, useState } from "react";
import { streamUrl } from "../api/client";

/**
 * Subscribe to the incident SSE stream for an organization and invoke a
 * callback on each update. Reconnects automatically via EventSource.
 * Fallbacks to polling when SSE is disconnected/inactive, with backoff and throttling.
 */
export function useIncidentStream(
  organizationId: string | undefined,
  onUpdate: () => void | Promise<void>,
  options?: { 
    isSimulationRunning?: boolean;
    onEvent?: (event: { type: string; data: any }) => void;
  }
) {
  const cb = useRef(onUpdate);
  cb.current = onUpdate;

  const [sseActive, setSseActive] = useState(false);
  const isSimulationRunning = options?.isSimulationRunning ?? false;

  useEffect(() => {
    const orgId = organizationId;
    if (!orgId) return;

    const controller = new AbortController();
    let es: EventSource | null = null;
    let isMounted = true;

    function connect() {
      if (!isMounted || !orgId || controller.signal.aborted) return;
      es = new EventSource(streamUrl(orgId));

      es.onopen = () => {
        if (isMounted) {
          setSseActive(true);
        }
      };

      es.onmessage = (event) => {
        if (isMounted && !controller.signal.aborted) {
          try {
            const parsed = JSON.parse(event.data);
            if (options?.onEvent && parsed) {
              options.onEvent(parsed);
            }
          } catch (e) {
            // best-effort event parsing
          }
          cb.current();
        }
      };

      es.onerror = () => {
        if (isMounted) {
          setSseActive(false);
        }
      };
    }

    connect();

    return () => {
      isMounted = false;
      controller.abort();
      if (es) {
        es.close();
      }
    };
  }, [organizationId]);

  // Polling fallback
  useEffect(() => {
    if (!organizationId) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    async function poll() {
      if (!isMounted) return;
      
      // Pause polling if SSE is active OR simulation is running
      if (!sseActive && !isSimulationRunning) {
        try {
          await cb.current();
        } catch (err) {
          console.error("Polling update failed:", err);
        }
      }

      // Schedule next tick only after the current one settles
      if (isMounted) {
        timerId = setTimeout(poll, 12000); // 12 seconds
      }
    }

    // Start the polling loop (runs in background, but conditionally pauses execution)
    timerId = setTimeout(poll, 12000);

    return () => {
      isMounted = false;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [organizationId, sseActive, isSimulationRunning]);

  return { sseActive };
}
