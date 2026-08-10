import React from 'react'
import "./SearchResult.css"
import { useNavigate } from 'react-router-dom';
import { slugifyUniversity } from '../../shared/slug';

export const SearchResult = ({ result }) => {
    const navigate = useNavigate()

    const handeClick = () => {
        // Prefer the slug the API returns; derive it if an older payload lacks one.
        navigate(`/university/${result.slug || slugifyUniversity(result.uni_name)}`);
    }

    return <div className='search-result' onClick={handeClick}>{result.uni_name}</div>
}