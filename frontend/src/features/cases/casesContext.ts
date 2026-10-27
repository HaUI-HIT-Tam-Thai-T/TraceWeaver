import { createContext, useContext } from "react";
import type { CasesState } from "./state";
import type { CaseFilters } from "./schemas";

export type CasesContextValue = {
  state: CasesState;
  setFilters: (filters: CaseFilters) => void;
  refresh: () => void;
  previousPage: () => void;
  nextPage: () => void;
};
export const CasesContext = createContext<CasesContextValue | undefined>(
  undefined,
);
export function useCases() {
  const value = useContext(CasesContext);
  if (!value) throw new Error("useCases must be used inside CasesProvider");
  return value;
}
