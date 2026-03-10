import { useContext } from "react";
import { ClubDataContext } from "./ClubDataContext";

export const useClubData = () => {
    const context = useContext(ClubDataContext);
    if (!context) {
        throw new Error('useClubData must be used within ClubDataProvider');
    }
    return context;
};