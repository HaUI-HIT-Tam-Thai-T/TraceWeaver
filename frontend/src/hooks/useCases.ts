import { useContext } from "react";
import { CasesContext } from "../features/cases/state/casesContext";

export function useCases() {
  const value = useContext(CasesContext);
  if (!value) throw new Error("useCases must be used inside CasesProvider");
  return value;
}
