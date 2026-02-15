/**
 * SanjayaProvider — React context that supplies a SanjayaClient to all
 * Sanjaya UI components.
 *
 * Usage (host app):
 *
 *   import { SanjayaProvider } from "@pojagi/sanjaya-ui";
 *   import { mySanjayaClient } from "./my-client";
 *
 *   <SanjayaProvider client={mySanjayaClient}>
 *     <ReportBuilder />
 *   </SanjayaProvider>
 */

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { SanjayaClient } from "../api/client";

const SanjayaContext = createContext<SanjayaClient | null>(null);

export interface SanjayaProviderProps {
  client: SanjayaClient;
  children: ReactNode;
}

export function SanjayaProvider({ client, children }: SanjayaProviderProps) {
  return (
    <SanjayaContext.Provider value={client}>
      {children}
    </SanjayaContext.Provider>
  );
}

/**
 * Hook to access the SanjayaClient from context.
 * Throws if used outside a `<SanjayaProvider>`.
 */
export function useSanjayaClient(): SanjayaClient {
  const client = useContext(SanjayaContext);
  if (!client) {
    throw new Error(
      "useSanjayaClient() must be used within a <SanjayaProvider>. " +
        "Wrap your component tree in <SanjayaProvider client={...}>.",
    );
  }
  return client;
}

export { SanjayaContext };
