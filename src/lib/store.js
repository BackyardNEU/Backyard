import { create } from "zustand";

//change this later on so that it determines whether it's true or false by extracting
//data from google authentification
export const useGlobalStore = create((set) => ({
  globalValue: false,
  lastPath: "/",
  unreadCount: 0,

  setGlobalValue: (newValue) => set({ GlobalValue: newValue }),
  setLastPath: (path) => set({ lastPath: path }),
  setUnreadCount: (count) => set({ unreadCount: count }),
}));

/*
import { useGlobalStore } from "../lib/store";

export default function Page2() {
  const globalValue = useGlobalStore((state) => state.globalValue);

  return <h1>The value is: {globalValue}</h1>;
}

to read in the global value
*/