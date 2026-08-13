import { create } from "zustand";

//change this later on so that it determines whether it's true or false by extracting
//data from google authentification
export const useGlobalStore = create((set) => ({
  // Signed-in flag. Named with a capital G because that is what setGlobalValue writes and
  // what all seven consumers read; the initial value was declared as `globalValue`
  // (lowercase), so it never matched and GlobalValue was undefined until AuthListener
  // first set it. Anything gated on it — the favorite heart in ClubGrid and ExpandedTile,
  // the review composer — rendered as logged-out on first paint.
  GlobalValue: false,
  lastPath: "/",
  unreadCount: 0,
  // Which view UniversityPage is showing — read by NavBar (a sibling, global
  // component) to light up the calendar/clubs icon, since that view lives in
  // UniversityPage's own local state and isn't otherwise reachable from outside it.
  calendarViewActive: false,
  // Login modal open state — in Zustand so deep components (e.g. ExpandedTile)
  // can open it without prop drilling.
  loginOpen: false,

  setGlobalValue: (newValue) => set({ GlobalValue: newValue }),
  setLastPath: (path) => set({ lastPath: path }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  setCalendarViewActive: (value) => set({ calendarViewActive: value }),
  setLoginOpen: (value) => set({ loginOpen: value }),
}));

/*
import { useGlobalStore } from "../lib/store";

export default function Page2() {
  const GlobalValue = useGlobalStore((state) => state.GlobalValue);

  return <h1>The value is: {GlobalValue}</h1>;
}

to read in the global value
*/