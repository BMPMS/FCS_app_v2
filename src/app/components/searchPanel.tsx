import React, { useState, ChangeEvent, useRef, useEffect } from "react";
import '../globals.css';
import SearchResultsHierarchyChart from "@/app/components/SearchResultsHierarchyChart";

interface SearchPanelProps {
    className: string;
    searchOptions: { inputs: string[], outputs: string[] };
    searchNodes: string[];
    setSearchNodes:  React.Dispatch<React.SetStateAction<string[]>>;
}

export default function SearchPanel({
                                        className,
                                        searchOptions,
                                        searchNodes,
                                        setSearchNodes
                                    }: SearchPanelProps) {

    const [query, setQuery] = useState("");
    const [toggleOpen, setToggleOpen] = useState(false);
    const [placeholder, setPlaceholder] = useState("Search inputs");
    const [currentSearchOptions, setCurrentSearchOptions] = useState(searchOptions["inputs"]);
    const [showOptions, setShowOptions] = useState(false);

    useEffect(() => {
        setCurrentSearchOptions(searchOptions["inputs"])
    }, [searchOptions])

    const panelRef = useRef<HTMLDivElement>(null); // ref for outside click

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        setShowOptions(value !== "");
    };


    const handleToggleOpen = () => {
        const newDirection = !toggleOpen;
        setToggleOpen(newDirection);
        setPlaceholder(newDirection ? "Search outputs" : "Search inputs");
        const newOptions = searchOptions[newDirection ? "outputs" : "inputs"];
        setCurrentSearchOptions(newOptions);
        setQuery("");
        setShowOptions(false);
        setSearchNodes([]);
    };

    // Hide dropdown when clicking outside the panel
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setShowOptions(false);
                setQuery("");
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Separate and sort selected and unselected filtered options
    const filteredSelected = currentSearchOptions
        .filter(opt => searchNodes.includes(opt) && opt.toLowerCase().includes(query.toLowerCase()));
    const filteredUnselected = currentSearchOptions
        .filter(opt => !searchNodes.includes(opt) && opt.toLowerCase().includes(query.toLowerCase()));

    const finalOptions = [...filteredSelected, ...filteredUnselected];


    const updatedCurrentSelected = (newSelection: string) => {
        if (!searchNodes.includes(newSelection)) {
            const newResults = searchNodes.concat(newSelection);
            setSearchNodes(newResults)
        } else {
            const filteredResults = searchNodes.filter((f) => f !== newSelection);
            setSearchNodes(filteredResults);
        }
        setQuery("");
        setShowOptions(false);

    }


    return (
        <div
            ref={panelRef}
            className={`searchContainer fixed w-[calc(55%-60px)] top-[calc(50%+10px)] left-[45px] md:w-[calc(35%-60px)] md:top-[20px] md:left-[80px]  bg-white border border-gray-300 rounded shadow   ${className}`}
        >
            <div className="flex items-center h-[35px] w-full">
                <input
                    type="text"
                    placeholder={placeholder}
                    value={query}
                    onChange={handleInputChange}
                    className="flex-grow h-full px-2 text-base outline-none"
                />
                <button
                    type="button"
                    aria-label={toggleOpen ? "Collapse" : "Expand"}
                    onClick={handleToggleOpen}
                    className="flex items-center justify-center ml-2 mr-2"
                >
                    <i
                        style={{ color: toggleOpen ? "#fd8d3c" : "#2171b5" }}
                        className={`fa-solid fa-${toggleOpen ? "up" : "down"}-from-dotted-line hover:text-gray-800 text-base`}
                    />
                </button>
            </div>
            <hr className={"border-t border-gray-300"} />
            {showOptions && finalOptions.length > 0 && (
                <SearchResultsHierarchyChart containerClass={"searchContainer"} searchStr={query} searchResults={finalOptions} currentSelected={filteredSelected} updateCurrentSelected={updatedCurrentSelected}/>
            )}
        </div>
    );
}
