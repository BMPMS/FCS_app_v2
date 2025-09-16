"use client"; // This marks the component to run on the client

import * as d3 from 'd3';
import {FC, useRef, useEffect, useState} from "react";
import {measureWidth} from "@/app/components/ChainForceChart_functions";
import {COLORS} from "@/app/components/MainForceChart";
import {getRemInPixels} from "@/app/components/sharedFunctions";


type SearchResultsCriteriaChartProps = {
    containerClass: string;
    currentSelected: string[];
    removeFromCurrentSelected: (currentSelection: string) => void;
    setResultPanelHeight: React.Dispatch<React.SetStateAction<number>>;
}


const SearchResultsCriteriaChart: FC<SearchResultsCriteriaChartProps> = ({
                                                                               containerClass,
                                                                               currentSelected,
                                                                             removeFromCurrentSelected,
                                                                             setResultPanelHeight
                                                     }) => {

    const [tick, setTick] = useState(0);
    const ref = useRef(null);
    // Modified hook that returns the tick value
    useEffect(() => {
        const handleResize = () => setTick(t => t + 1);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {

        // svgs and sizing
        if (!ref.current) return;
        const svg = d3.select<SVGSVGElement,unknown>(ref.current);


            const svgNode = svg.node();
            if (!svgNode) return;

            const containerNode = d3.select<Element, unknown>(`.${containerClass}`).node();
            if (!containerNode) return;

            const {  clientWidth: svgWidth } = containerNode;

            const fontSize = getRemInPixels() * 0.8;
             const padding = fontSize/4;
            const panelHeight = fontSize + (padding * 2);
            const lineHeight = panelHeight + (padding * 2);
            const margin = 15;
            const gap = margin/3;
            let currentLinePosition = gap;
            const closeWidth = 30;
            let currentLine = 1;
            const selectedData = currentSelected.reduce((acc,entry) => {
                const resultWidth = measureWidth(entry,fontSize) + margin + closeWidth ;

                if((currentLinePosition + resultWidth) > (svgWidth - (margin * 2))){
                  currentLinePosition = margin;
                  currentLine += 1;
                }
                acc.push({
                    searchTerm: entry,
                    x: currentLinePosition,
                    line: currentLine,
                    width: resultWidth - gap
                })
                currentLinePosition += resultWidth;
                return acc;
            },[] as {searchTerm: string,x: number, width: number,line: number}[])

            const resultsHeight = padding + lineHeight * (d3.max(selectedData, (d) => d.line) || 0);

            setResultPanelHeight(resultsHeight);
            svg.attr("width", svgWidth)
                .attr("height",`${resultsHeight}px`);

        const panelGroup = svg
            .selectAll(".treeGroup")
            .data(selectedData)
            .join((group) => {
                const enter = group.append("g").attr("class", "treeGroup");
                enter.append("rect").attr("class", "backgroundRect");
                enter.append("text").attr("class", "textLabel");
                enter.append("text").attr("class", "closeLabel");
                return enter
            })

        panelGroup.attr("transform",(d) => `translate(0,${padding + lineHeight * (d.line - 1)})`)

        panelGroup.select(".backgroundRect")
            .attr("x", (d) =>  d.x)
            .attr("y",padding)
            .attr("width", (d) => d.width)
            .attr("height", panelHeight)
            .attr("fill",COLORS.lightgrey)
            .attr("rx",5)
            .attr("ry",5);

        panelGroup.select(".textLabel")
            .attr("x", (d) => gap + d.x)
            .attr("y",  1 + lineHeight/2)
            .attr("fill",COLORS.black)
            .style("dominant-baseline","middle")
            .attr("font-size",fontSize)
            .text((d) => d.searchTerm);

        panelGroup.select(".closeLabel")
            .attr("cursor","pointer")
            .attr("x", (d) =>  d.x + d.width - (gap * 2))
            .attr("y",  1 + lineHeight/2)
            .attr("fill",COLORS.black)
            .style("dominant-baseline","middle")
            .attr("text-anchor","end")
            .attr("font-size",fontSize)
            .text("x")
            .on("click", (event,d) => {
                removeFromCurrentSelected(d.searchTerm)
            });





    }, [containerClass, currentSelected, removeFromCurrentSelected,setResultPanelHeight,tick]);


    return (
        <>
            <svg className={`noselect svg_${containerClass}`} ref={ref}>
            </svg>
            </>

    );
};

export default SearchResultsCriteriaChart;
