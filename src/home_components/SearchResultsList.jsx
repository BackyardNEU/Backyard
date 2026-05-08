import React from 'react'
import {SearchResult} from "./SearchResult"

import './SearchResultsList.css'

export const SearchResultsList = ({ results }) => {
    return <div className="results-list">
        {
            results.map((result) => {
                //return <div key={result.id}>{result.uni_name}</div>
                return <SearchResult result={result} key={result.id}/>
            })
        }
    </div>
    
}