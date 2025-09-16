"use client"; // This marks the component to run on the client

import * as d3 from 'd3';
import {FC, useRef, useEffect} from "react";
import {drawTreeChart, splitSearchResults} from "@/app/components/SearchResultsHierarchyChart_functions";


type SearchResultsHierarchyChartProps = {
    containerClass: string;
    searchStr: string;
    searchResults: string[];
    currentSelected: string[];

    updateCurrentSelected: (newSelection: string) => void;
}

export const HIERARCHY_NODE_HEIGHT = 32;

const SearchResultsHierarchyChart: FC<SearchResultsHierarchyChartProps> = ({
                                                                               containerClass,
                                                                               searchResults,
    currentSelected,
                                                                               searchStr,
    updateCurrentSelected
                                                     }) => {



     const ref = useRef(null);

    useEffect(() => {

        // svgs and sizing
        if (!ref.current) return;
        const svg = d3.select<SVGSVGElement,unknown>(ref.current);
        async function renderChart() {

            const svgNode = svg.node();
            if (!svgNode) return;

            const containerNode = d3.select<Element, unknown>(`.${containerClass}`).node();
            if (!containerNode) return;

            const {  clientWidth: svgWidth } = containerNode;

            const splitResults = await splitSearchResults(searchResults);


            svg.attr("width", svgWidth)
                .attr("height",splitResults.length * HIERARCHY_NODE_HEIGHT);

            drawTreeChart(svg,svgWidth,splitResults,searchStr, currentSelected,updateCurrentSelected);

        }

        renderChart();

    }, [containerClass, searchStr, searchResults,currentSelected,updateCurrentSelected]);


    return (
        <>
            <svg className={`noselect svg_${containerClass}`} ref={ref}>
            </svg>
            </>

    );
};

export default SearchResultsHierarchyChart;
