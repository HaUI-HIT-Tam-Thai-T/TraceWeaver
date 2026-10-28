import { useContext } from "react";
import { EventsContext } from "../state/eventsContext";

export function useEvents() {
  const value = useContext(EventsContext);
  if (!value) throw new Error("useEvents must be used inside EventsProvider");
  return value;
}
