"use client"; // This marks the component to run on the client

import * as d3 from 'd3';
import {FC, useRef, useEffect, useState} from "react";
import {ChartData, ChartLink, NetworkLink, NetworkNode} from "@/types/data";
import {
    drawVoronoiTree,
    drawZoomButtons,
} from "@/app/components/MainForceChart_functions";
import {drawArrowDefs, getNodeRadiusAndLabelSize} from "@/app/components/sharedFunctions";
import {CHAIN_CIRCLE_RADIUS} from "@/app/components/ChainForceChart";


export const MAX_CIRCLE_RADIUS = 75;
export const COLORS = {
    lightgreen: "#a1d99b",
    midgreen: "#41ab5d",
    darkgreen: "#006d2c",
    lightblue: "#6baed6",
    orange: "#fd8d3c",
    midblue: "#2171b5",
    darkblue: "#08306b",
    red: "#cb181d",
    grey: "#A0A0A0",
    lightgrey: "#E0E0E0",
    midgrey: "#C0C0C0",
    darkgrey: "#808080",
    black: "#484848",
    gold:"gold"
};

export const NODEFLOW_COLORS = {
    input: COLORS.midblue,
    intermediate: COLORS.darkgrey,
    output: COLORS.orange,
    successfulOutput: COLORS.orange,
    failedOutput: COLORS.red,
    successfulLink: COLORS.midgreen,
    suppressedLink: COLORS.red,
    link: COLORS.midgrey
};
export const NODETYPE_ICONS = {
    comp: "\uf661",
    all: "\ue439",
    any: "\ue438",
    suppression: "\uf714",
    play:"\uf04b",
    chain: "\uf0e8",
    menu: "\ue1d2"
};

export const NODETYPE_ICON_NAMES = {
    comp: "fa-solid fa-function",
    all: "fa-solid fa-pipe-valve",
    any: "fa-solid fa-pipe-section",
    suppression: "fa-solid fa-skull-crossbones",
};

export const MARKER_IDS = [
    "arrowEndGrey",
    "arrowStartGreen",
    "arrowEndGreen",
    "arrowStartRed",
    "arrowEndRed",
]

export const ARROW_START_PATH = "M9,-4L1,0L9,4";
export const ARROW_END_PATH = "M1, -4L9,0L1,4";
export const ARROW_VIEWBOX = "0 -5 10 10";

export const ICONS = {zoomFit:"\uf0b2",zoomOut:"\uf010",zoomIn:"\uf00e", locked:"\uf023", unlocked:"\uf3c1"};

export const MAIN_CHART_PANEL_HEIGHT = 45;
export const NODE_FILL_OPACITY_START = 0.3;
export const NODE_FONT_SIZE_START = 3;

interface MainForceChartProps {
    chartData: ChartData;
    architectureId: number;
    containerClass: string;
    chainContainerClass: string;
    searchNodes: string[];
}

const MainForceChart: FC<MainForceChartProps> = ({
                                                                 containerClass,
                                                                 chainContainerClass,
                                                                 chartData,

                                                     architectureId,
                                                 searchNodes}) => {


    const [tick, setTick] = useState(0);
    const simulation: React.RefObject<d3.Simulation<NetworkNode, NetworkLink> | undefined> = useRef(undefined);

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
        const baseSvg = d3.select<SVGSVGElement,unknown>(ref.current);

        const svgNode = baseSvg.node();
        if (!svgNode) return;

        const containerNode = d3.select<Element, unknown>(`.${containerClass}Container`).node();
        if (!containerNode) return;
        const {  clientHeight: svgHeight, clientWidth: svgWidth } = containerNode;

        const currentArchitecture =  chartData.architecture
            .find((f) => f.arch_id === architectureId);

        if(!currentArchitecture) return;

        const architectureLinks = currentArchitecture.routes.reduce((acc, entry,index) => {
            acc.push({
                source: `${entry.source_node}-${entry.source_net}`,
                target: `${entry.dest_node}-${entry.dest_net}`,
                type: "architecture",
                id: `archLink${index}`
            })
            return acc;
        },[] as ChartLink[])

       const currentNetworks = chartData.networks
           .filter((f) => currentArchitecture.layers.find((l) => l.network === f.id));

        baseSvg.attr('width', svgWidth)
            .attr('height', svgHeight)
            .style("background-color","transparent");

        drawArrowDefs(baseSvg,containerClass,MARKER_IDS,12);


        // svg = parts which are affected by zoom
        const svg = baseSvg.select(".chartSvg");
        if(simulation.current){
            simulation.current.stop();
        }

        simulation.current = d3
            .forceSimulation<NetworkNode, NetworkLink>()
            .force("x", d3.forceX<NetworkNode>((d) => d.centreX).strength(0.4))
            .force("y", d3.forceY<NetworkNode>((d) => d.centreY).strength(0.4))
            .force("collide", d3.forceCollide<NetworkNode>()
                .radius((d) => (d.radius || 0) * 3.5)
                .strength(0.8)
                .iterations(4)
            )
            .force("link", d3.forceLink<NetworkNode,d3.SimulationLinkDatum<NetworkNode>>().id((d) => d.node.id).strength(0))


        simulation.current.stop();

        const margins =   {left: 5, right: 5, top: 5, bottom: MAIN_CHART_PANEL_HEIGHT};

        const chartWidth = svgWidth - margins.left - margins.right;
        const chartHeight = svgHeight - margins.top - margins.bottom;

        drawVoronoiTree(svg,currentNetworks,architectureLinks,chartWidth,chartHeight,margins, containerClass,chainContainerClass,simulation.current);

        const nodeCount = d3.sum(currentNetworks,(d) => d.data.nodes.length);

        const {nodeRadius} = getNodeRadiusAndLabelSize(chartWidth,chartHeight,nodeCount)
        const zoom = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([ 1,10])
            .translateExtent([[0,0],[svgWidth,svgHeight]])
            .on("zoom", (event) => {
                const { x, y, k } = event.transform;
                svg.selectAll(".nodeLabelsGroup")
                    .attr("display", k > 1.5 ? "none" : "block");
                const radiusAboveLimit = nodeRadius * k >= CHAIN_CIRCLE_RADIUS;
                svg.selectAll(".networkNode")
                    .attr("fill-opacity", radiusAboveLimit ? 1 : NODE_FILL_OPACITY_START);
                svg.selectAll(".networkNodeIcon")
                    .attr("visibility", radiusAboveLimit ? "visible" : "hidden");
                svg.selectAll(".linkPath")
                    .attr("marker-end", radiusAboveLimit ? `url(#arrowEndGrey${containerClass})` : "")

                const labelFontSize = NODE_FONT_SIZE_START * k;

                svg.selectAll(".networkNodeLabel")
                    .attr("visibility", labelFontSize > 12 ? "visible" : "hidden");

                svg.attr("transform", `translate(${x},${y}) scale(${k})`);
            });



        drawZoomButtons(baseSvg,svgWidth,svgHeight,[],zoom);

        baseSvg.call(zoom).on("dblclick.zoom", null);

    }, [containerClass, chartData, architectureId, searchNodes, tick, chainContainerClass]);


    return (
        <>
            <div id="mainChartTooltip" className={"chartTooltip"}/>
            <svg className={`noselect svg_${containerClass}`} ref={ref}>
                <defs className={"arrowDefs"}>
                </defs>
                <g className={"chartSvg"}>
                    <g className={"nodesGroup"}/>
                    <g className={"linksGroup"}/>
                    <g className={"networkNodesGroup"}/>
                    <g className={"nodeLabelsGroup"}/>
                </g>
                <g className={"buttonsGroup"}/>
            </svg></>
    );
};

export default MainForceChart;
