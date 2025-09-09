"use client"; // This marks the component to run on the client

import * as d3 from 'd3';
import {FC, useRef, useEffect} from "react";
import {ChainLink, ChainNode, ChartData, NetworkLink, NetworkNode} from "@/types/data";
import {
    buildDataGraph,
    drawChainForce,
    getNodeChain, handleAnimationFlow
} from "@/app/components/ChainForceChart_functions";
import {COLORS, NODETYPE_ICONS} from "@/app/components/MainForceChart";
import Graph from "graphology";
import {Attributes} from "graphology-types";
import {drawArrowDefs} from "@/app/components/sharedFunctions";

type ChainForceChartProps = {
    containerClass: string;
    mainContainerClass: string;
    chartData: ChartData;
    searchNodes: string[];
    searchDirection:string;
    architectureId: number;
}

export const CHAIN_CIRCLE_RADIUS = 12;
export const NODE_HIGHLIGHT_STROKE_WIDTH = 2;

const ChainForceChart: FC<ChainForceChartProps> = ({
                                                                 containerClass,
    mainContainerClass,
                                                                 chartData,
                                                                 searchNodes,
                                                          searchDirection,
                                                                 architectureId
                                                     }) => {
    const currentDirection: React.RefObject<string> = useRef("input");
    const selectedChart: React.RefObject<"chain" | "menu"> = useRef("chain");
    const currentArchitectureId: React.RefObject<number> = useRef(-1);
    const currentGraph: React.RefObject< Graph<Attributes, Attributes, Attributes> | undefined> = useRef(undefined);
    const ref = useRef(null);

    useEffect(() => {

        // svgs and sizing
        if (!ref.current) return;
        const svg = d3.select<SVGSVGElement,unknown>(ref.current);

        const svgNode = svg.node();
        if (!svgNode) return;

        const containerNode = d3.select<Element, unknown>(`.${containerClass}Container`).node();
        if (!containerNode) return;

        let {  clientHeight:svgHeight,  clientWidth: svgWidth } = containerNode;

        const margin = {left: 10, right: 10, top: 5, bottom: 5};

        const headerSvg =  d3.select<Element, unknown>(`.headerSvg_${containerClass}`)

        const headerHeight = 45;
        svg.attr('width', svgWidth)
            .attr('height', svgHeight - headerHeight);

        headerSvg.attr('width', svgWidth)
            .attr('height', "60px");

        const markerIds = [
            "arrowEndGrey",
            "arrowStartGreen",
            "arrowEndGreen",
            "arrowStartRed",
            "arrowEndRed",
        ]


        drawArrowDefs(svg,containerClass,markerIds,12);

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
        if(currentGraph.current){

            const {allNodes:nodes, allLinks:links} = getNodeChain(currentGraph.current, searchNodes,searchDirection);
            const depthMax = d3.max(nodes, (d) => d.depth) || 0;


            const selectedNodes = nodes.map((m) => m.id);

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

            const maxDepth = d3.max(nodes, (d) => d.depth) || 0;
            const maxPerDepth = d3.max(
                Array.from(d3.group(nodes, (g) => g.depth)),
                (m) => m[1].length) || 0;

            const minDepthHeight = 60;
            const minHeightNeeded = (depthMax * minDepthHeight) + margin.top - margin.bottom;

            if(svgHeight < minHeightNeeded){
                svgHeight = minHeightNeeded;
                svg.attr("height",`${svgHeight}px`);
            };


            const minNodeWidth = CHAIN_CIRCLE_RADIUS * 5;
            const minWidthNeeded = minNodeWidth * (maxPerDepth + 1);
            if(svgWidth < minWidthNeeded){
                svgWidth = minWidthNeeded - minNodeWidth;
                svg.attr("width",`${svgWidth}px`);
            }


            const depthHeight = (svgHeight - margin.top - margin.bottom)/(depthMax + 2);


            svg.select(".chartGroup")
                .attr("transform",`translate(0,${margin.top})`)


            const collideRadius = (svgWidth/(maxPerDepth + 1))/2;

            const simulation = d3
                .forceSimulation()
                .force("x", d3.forceX<ChainNode>(svgWidth/2).strength(0.05))
                .force("y", d3.forceY<ChainNode>((d) => ((searchDirection === "input" ? d.depth : maxDepth - d.depth) + 0.5) * depthHeight).strength(1))
                .force("link", d3.forceLink<ChainNode,ChainLink>().id((d) => d.id).strength(0))
                .force("collide", d3.forceCollide<ChainNode>().radius(Math.max(collideRadius,CHAIN_CIRCLE_RADIUS * 1.4)).strength(1).iterations(2))

            simulation.stop();



            drawChainForce(svg,nodes,links,simulation,searchNodes,containerClass,mainContainerClass,currentGraph.current);

            const buttonSize = CHAIN_CIRCLE_RADIUS * 1.25;

            headerSvg.select(".nodeCountLabel")
                .attr("x",(buttonSize * 2) + 12)
                .attr("y",25)
                .attr("font-size",16)
                .attr("fill",COLORS.darkgrey)
                .attr("text-anchor", "start")
                .attr("font-weight",500)
                .text(`${nodes.length} nodes`)

            headerSvg.select(".playButton")
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
                        handleAnimationFlow(svg,300,containerClass,mainContainerClass, nodes,links,searchNodes,currentGraph.current);
                    }
                 })

            headerSvg
                .select(".playButtonIcon")
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
                .attr("stroke",selectedChart.current === "chain" ? COLORS.gold: COLORS.midgrey)
                .attr("stroke-width",selectedChart.current === "chain" ? 2.5:1)
                .attr("r", searchDirection === "input" ? CHAIN_CIRCLE_RADIUS : 0)
                .attr("cx",svgWidth - (buttonSize * 5) - 5)
                .attr("cy", buttonSize + 5)
                .attr("cursor","pointer");

            headerSvg
                .select(".chainViewButtonIcon")
                .attr("pointer-events","none")
                .attr("x",svgWidth - (buttonSize * 5) - 5 )
                .attr("y", 5 + buttonSize - 0.25)
                .attr("font-size",  buttonSize * 0.9)
                .attr("fill", COLORS.darkgrey)
                .attr("text-anchor","middle")
                .style("dominant-baseline","middle")
                .text( searchDirection === "input" ? NODETYPE_ICONS["chain"] : "");

            headerSvg.select(".menuViewButton")
                .attr("fill","white")
                .attr("stroke",COLORS.midgrey)
                .attr("stroke",selectedChart.current === "menu" ? COLORS.gold: COLORS.midgrey)
                .attr("stroke-width",selectedChart.current === "menu" ? 2.5:1)
                .attr("r", searchDirection === "input" ? CHAIN_CIRCLE_RADIUS : 0)
                .attr("cx",svgWidth - (buttonSize * 3) - 5)
                .attr("cy", buttonSize + 5)
                .attr("cursor","pointer");

            headerSvg
                .select(".menuViewButtonIcon")
                .attr("pointer-events","none")
                .attr("x",svgWidth - (buttonSize * 3) - 4)
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


        }







    }, [containerClass, chartData, architectureId,searchNodes,searchDirection, mainContainerClass]);


    return (
        <>
            <div id="chainChartTooltip" className={"chartTooltip"}/>
            <svg className={`noselect headerSvg_${containerClass}`}>
                <circle className={"playButton"}/>
                <text className={"fa playButtonIcon"}/>
                <text className={"nodeCountLabel"}></text>
                <circle className={"chainViewButton"}/>
                <text className={"fa chainViewButtonIcon"}/>
                <circle className={"menuViewButton"}/>
                <text className={"fa menuViewButtonIcon"}/>
                <line className={"headerLine"}/>
            </svg>
            <svg className={`noselect svg_${containerClass}`} ref={ref}>
                <defs className={"arrowDefs"}>
                </defs>
                <g className={"chartGroup"}>
                    <g className={"linkGroup"}/>
                    <g className={"nodeGroup"}/>
                </g>

            </svg>
            </>

    );
};

export default ChainForceChart;
