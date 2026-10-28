import { useContext } from "react";
import { CasesContext } from "../state/casesContext";

export function useCases() {
  const value = useContext(CasesContext);
  if (!value) throw new Error("useCases must be used inside CasesProvider");
  return value;
}
