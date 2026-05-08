import React from 'react'
import "./SearchResult.css"
import { useNavigate } from 'react-router-dom';

export const SearchResult = ({ result }) => {
    const navigate = useNavigate()

    const handeClick = () => {
        navigate(`/university/${result.id}`);
    }

    return <div className='search-result' onClick={handeClick}>{result.uni_name}</div>
}