"use client"; // This marks the component to run on the client

import * as d3 from 'd3';
import {FC, useRef, useEffect, useState} from "react";
import {ChainLink, ChainNode, ChartData, NetworkLink, NetworkNode} from "@/types/data";
import {
    buildDataGraph,
    getNodeChain,
} from "@/app/components/ChainForceChart_functions";
import {COLORS, NODETYPE_ICONS} from "@/app/components/MainForceChart";
import Graph from "graphology";
import {Attributes} from "graphology-types";
import ChainForceChart from "@/app/components/ChainForceChart";
import ChainHierarchyChart from "@/app/components/ChainHierarchyChart";

type ChainChartHeaderProps = {
    containerClass: string;
    mainContainerClass: string;
    chartData: ChartData;
    searchNodes: string[];
    searchDirection:string;
    architectureId: number;
    resultPanelHeight: number;
}

export const CHAIN_CIRCLE_RADIUS = 12;

export interface ChartHandle {
    runAnimation: () => void;
}
const ChainChartHeader: FC<ChainChartHeaderProps> = ({
                                                                 containerClass,
    mainContainerClass,
                                                                 chartData,
                                                                 searchNodes,
                                                          searchDirection,
                                                                 architectureId,
                                                       resultPanelHeight
                                                     }) => {
    const [tick, setTick] = useState(0);

    const currentDirection: React.RefObject<string> = useRef("input");
   const currentArchitectureId: React.RefObject<number> = useRef(-1);
    const currentGraph: React.RefObject< Graph<Attributes, Attributes, Attributes> | undefined> = useRef(undefined);
    const [chainChartData, setChainChartData] = useState<{nodes: ChainNode[],links:ChainLink[]}>({nodes:[],links:[]});
    const [selectedChart, setSelectedChart] = useState<"chain" | "menu">("menu");

    const ref = useRef(null);
    const chainForceRef = useRef<ChartHandle>(null);

    // Modified hook that returns the tick value
    useEffect(() => {
        const handleResize = () => setTick(t => t + 1);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    useEffect(() => {
        // svgs and sizing
        if (!ref.current) return;

        const headerSvg = d3.select<SVGSVGElement,unknown>(ref.current);

        const svgNode = headerSvg.node();
        if (!svgNode) return;

        const containerNode = d3.select<Element, unknown>(`.${containerClass}Container`).node();
        if (!containerNode) return;

        const {  clientHeight:svgHeight,  clientWidth: svgWidth } = containerNode;

        const headerHeight = 60;

        const containerDiv = d3.select(`.containerDiv${containerClass}`);
        containerDiv
            .style("width",`${svgWidth}px`)
            .style("height",`${svgHeight}px`);

        const overflowDiv = d3.select(`.overflowDiv${containerClass}`);

        overflowDiv
            .style("width",`${svgWidth}px`)
            .style("height",`${svgHeight-headerHeight}px`)
            .style("overflow","auto");

        headerSvg.attr('width', svgWidth)
            .attr('height', `${headerHeight}px`);

       // keeping filter in the chart for now in case multiple architecture view is needed later
        const currentArchitecture =  chartData.architecture
                .find((f) => f.arch_id === architectureId);

        if(!currentArchitecture)return;
       const currentNetworks = chartData.networks
           .filter((f) => currentArchitecture.layers.some((s) => s.network === f.id))
               .map(f => ({ ...f.data }));

        if(currentArchitectureId.current !== architectureId || currentDirection.current !== searchDirection){
            currentArchitectureId.current = architectureId;
            currentDirection.current = searchDirection;
            currentGraph.current = buildDataGraph(currentNetworks,currentArchitecture.routes);
        }
        if(!currentGraph.current) return

        const {allNodes, allLinks} = getNodeChain(currentGraph.current, searchNodes,searchDirection);

        setChainChartData({nodes: allNodes,links: allLinks});

        const selectedNodes = allNodes.map((m) => m.id);
        const mainGraphSvg = d3.select(`.svg_${mainContainerClass}`);

        if(mainGraphSvg.node()){

            mainGraphSvg.selectAll<SVGLineElement,NetworkLink>(".linkPath")
                .attr("opacity",0);
            mainGraphSvg.selectAll<SVGGElement,NetworkNode>(".networkChainNode")
                .attr("opacity",(n) => selectedNodes.includes(n.node.id) ? 1 : 0);

            mainGraphSvg.selectAll<SVGGElement,NetworkNode>(".networkChainNodeIcon")
                .attr("opacity",(n) => selectedNodes.includes(n.node.id) ? 1 : 0);

            mainGraphSvg.selectAll<SVGLineElement,NetworkLink>(".linkChainPath")
                .attr("stroke-width", (d) => {
                    if(typeof d.source === "string" || typeof d.target === "string") return 0;
                    const sourceAndTargetSelected = selectedNodes.includes(d.source.node.id) &&
                        selectedNodes.includes(d.target.node.id);
                    return searchNodes.length === 0 || !sourceAndTargetSelected ? 0 :
                        CHAIN_CIRCLE_RADIUS/10
                })
        }

        const buttonSize = CHAIN_CIRCLE_RADIUS * 1.25;

        headerSvg.select(".nodeCountLabel")
            .attr("x",(buttonSize * 2) + 12)
            .attr("y",25)
            .attr("font-size",16)
            .attr("fill",COLORS.darkgrey)
            .attr("text-anchor", "start")
            .attr("font-weight",500)
            .text(`${allNodes.length} nodes`)

        headerSvg.select(".playButton")
         //   .attr("visibility", selectedChart === "chain" ? "visible" : "hidden")
            .attr("fill","white")
            .attr("stroke",COLORS.midgrey)
            .attr("r", searchDirection === "input" ? CHAIN_CIRCLE_RADIUS : 0)
            .attr("cx",buttonSize + 5)
            .attr("cy", buttonSize + 5)
            .attr("cursor","pointer")
            .on("mouseover", (event) => {
                d3.select(event.currentTarget).attr("fill",COLORS.lightgrey)
            })
            .on("mouseout", (event) => {
                d3.select(event.currentTarget).attr("fill","white")
            })
            .on("click", () => {
                if(currentGraph.current){
                    const chainSvgRef = chainForceRef.current;
                    if(chainSvgRef){
                        chainSvgRef.runAnimation();
                    }
                }
             })

        headerSvg
            .select(".playButtonIcon")
           // .attr("visibility", selectedChart === "chain" ? "visible" : "hidden")
            .attr("pointer-events","none")
            .attr("x",buttonSize + 6)
            .attr("y", buttonSize + 5)
            .attr("font-size",  buttonSize * 0.9)
            .attr("fill", COLORS.darkgrey)
            .attr("text-anchor","middle")
            .style("dominant-baseline","middle")
             .text( searchDirection === "input" ? NODETYPE_ICONS["play"] : "");

        headerSvg.select(".chainViewButton")
            .attr("fill","white")
            .attr("stroke",selectedChart === "chain" ? COLORS.gold: COLORS.midgrey)
            .attr("stroke-width",selectedChart === "chain" ? 2.5:1)
            .attr("r", searchDirection === "input" ? CHAIN_CIRCLE_RADIUS : 0)
            .attr("cx",svgWidth - (buttonSize * 2) - 5)
            .attr("cy", buttonSize + 5)
            .attr("cursor","pointer")
            .on("mouseover", (event) => {
                d3.select(event.currentTarget).attr("fill",COLORS.lightgrey);
            })
            .on("mouseout", () => {
                headerSvg.selectAll(".toggleButton").attr("fill","white")
            })
            .on("click", () => {
                setSelectedChart("chain");
            });

        headerSvg
            .select(".chainViewButtonIcon")
            .attr("pointer-events","none")
            .attr("x",svgWidth - (buttonSize * 2) - 4)
            .attr("y", 5 + buttonSize - 0.25)
            .attr("font-size",  buttonSize * 0.9)
            .attr("fill", COLORS.darkgrey)
            .attr("text-anchor","middle")
            .style("dominant-baseline","middle")
            .text( searchDirection === "input" ? NODETYPE_ICONS["chain"] : "");

        headerSvg.select(".menuViewButton")
            .attr("fill","white")
            .attr("stroke",COLORS.midgrey)
            .attr("stroke",selectedChart === "menu" ? COLORS.gold: COLORS.midgrey)
            .attr("stroke-width",selectedChart === "menu" ? 2.5:1)
            .attr("r", searchDirection === "input" ? CHAIN_CIRCLE_RADIUS : 0)
            .attr("cx",svgWidth - (buttonSize * 4) - 5)
            .attr("cy", buttonSize + 5)
            .attr("cursor","pointer")
            .on("mouseover", (event) => {
                d3.select(event.currentTarget).attr("fill",COLORS.lightgrey);
            })
            .on("mouseout", () => {
                headerSvg.selectAll(".toggleButton").attr("fill","white")
            })
            .on("click", () => {
               setSelectedChart("menu");
            });;

        headerSvg
            .select(".menuViewButtonIcon")
            .attr("pointer-events","none")
            .attr("x",svgWidth - (buttonSize * 4) - 5 )
            .attr("y", buttonSize + 5)
            .attr("font-size", buttonSize * 0.9)
            .attr("fill", COLORS.darkgrey)
            .attr("text-anchor","middle")
            .style("dominant-baseline","middle")
            .text( searchDirection === "input" ? NODETYPE_ICONS["menu"] : "");

        headerSvg.select(".headerLine")
            .attr("x1",0)
            .attr("x2", svgWidth)
            .attr("y1",headerHeight - 1)
            .attr("y2",headerHeight -1)
            .attr("stroke-width",1)
            .attr("stroke",COLORS.midgrey)

        headerSvg.select(".headerTopLine")
            .attr("x1",0)
            .attr("x2", svgWidth)
            .attr("y1",1)
            .attr("y2",1)
            .attr("stroke-width",1)
            .attr("stroke",COLORS.midgrey)


    }, [selectedChart,currentGraph,containerClass, chartData, architectureId,searchNodes,searchDirection, mainContainerClass,resultPanelHeight,tick]);


    return (
        <>
            <div id="chainChartTooltip" className={"chartTooltip"}/>
            <div className={`containerDiv${containerClass}`}>
                <svg ref={ref} className={`noselect headerSvg_${containerClass}`}>
                    <line className={"headerTopLine"}/>
                    <circle className={"playButton"}/>
                    <text className={"fa playButtonIcon"}/>
                    <text className={"nodeCountLabel"}></text>
                    <circle className={"toggleButton chainViewButton"}/>
                    <text className={"fa chainViewButtonIcon"}/>
                    <circle className={"toggleButton menuViewButton"}/>
                    <text className={"fa menuViewButtonIcon"}/>
                    <line className={"headerLine"}/>
                </svg>
                <div className={`overflowDiv${containerClass}`}>
                    {selectedChart === "chain"  && <ChainForceChart
                        ref={chainForceRef}
                        mainContainerClass={mainContainerClass}
                        containerClass={containerClass}
                        currentGraph={currentGraph.current}
                        searchNodes={searchNodes}
                        searchDirection={searchDirection}
                        chainChartData={chainChartData}
                    />}
                    {selectedChart === "menu"  && <ChainHierarchyChart
                        mainContainerClass={mainContainerClass}
                        containerClass={containerClass}
                        currentGraph={currentGraph.current}
                        searchNodes={searchNodes}
                        searchDirection={searchDirection}
                        chainChartData={chainChartData}
                    />}
                </div>
            </div>
            </>

    );
};

export default ChainChartHeader;
