import * as d3 from 'd3';
import {
    ChainNode,
    ChartLink,
    ChartNode,
    Network, NetworkLink, NetworkNode, TreeData, VoronoiNode,
} from "@/types/data";
import {
    COLORS,
    ICONS,
    MAX_CIRCLE_RADIUS, NODE_FILL_OPACITY_START, NODE_FONT_SIZE_START, NODEFLOW_COLORS, NODETYPE_ICONS,
} from "@/app/components/MainForceChart";
import {CHAIN_CIRCLE_RADIUS, NODE_HIGHLIGHT_STROKE_WIDTH} from "@/app/components/ChainForceChart";
// @ts-expect-error no typescript definition for voronoiTreemap
import { voronoiTreemap } from 'd3-voronoi-treemap';
import seedrandom from 'seedrandom';
import {BaseType} from "d3";
import {getTooltipText, measureWidth} from "@/app/components/ChainForceChart_functions";
// @ts-expect-error no typescript definition for clipper-lib
import ClipperLib from 'clipper-lib';
import {getNodeRadiusAndLabelSize} from "@/app/components/sharedFunctions";

type GetZoomCalculations = {
    nodes: ChartNode[];
    height: number;
    width: number;
};

const getZoomCalculations = ({
                                 nodes,
                                 height,
                                 width,
                             }: GetZoomCalculations) => {
    // might have to have a maxRadius here
    const [xExtent0, xExtent1] = d3.extent(nodes, (d) => d.fx || d.x);
    const [yExtent0, yExtent1] = d3.extent(nodes, (d) => d.fy || d.y);

    if (xExtent0 !== undefined && xExtent1 !== undefined && yExtent0 !== undefined && yExtent1 !== undefined) {
        // minWidthHeight is a check to make sure it doesn't zoom to close with 1 or 2 nodes
        const minWidthHeight = MAX_CIRCLE_RADIUS * 5;
        let xWidth = xExtent1 - xExtent0 + MAX_CIRCLE_RADIUS * 2;
        let yWidth = yExtent1 - yExtent0 + MAX_CIRCLE_RADIUS * 2;

        xWidth = Math.max(xWidth, minWidthHeight);
        yWidth = Math.max(yWidth, minWidthHeight);

        const translateX = -(xExtent0 + xExtent1) / 2;
        const translateY = -(yExtent0 + yExtent1) / 2;
        const fitToScale = 0.9 / Math.max(xWidth / width, yWidth / height);
        return {translateX, translateY, fitToScale};
    }
    return {translateX: 0, translateY: 0, fitToScale: 1};
};

type PerformZoomAction = {
    baseSvg: d3.Selection<SVGSVGElement, unknown, HTMLElement, undefined>;
    nodes: ChartNode[];
    height: number;
    transitionTime: number;
    width: number;
    zoomAction: string;
    zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
};

const performZoomAction =  ({
                                baseSvg,
                                nodes,
                                height,
                                transitionTime,
                                width,
                                zoomAction,
                                zoom,
                            }: PerformZoomAction) =>  {
    baseSvg.selectAll(".buttonItems").attr("opacity",0);
    if (zoomAction === 'zoomIn') {
        baseSvg.interrupt().transition().duration(transitionTime).call(zoom.scaleBy, 2);
    }
    if (zoomAction === 'zoomOut') {
        baseSvg.interrupt().transition().duration(transitionTime).call(zoom.scaleBy, 0.5);
    }
    if (zoomAction === 'zoomFit') {
        const {translateX, translateY, fitToScale} = getZoomCalculations({
            nodes: nodes,
            height,
            width,
        });
        baseSvg
            .interrupt()
            .transition()
            .duration(transitionTime)
            .call(
                zoom.transform,
                d3.zoomIdentity
                  //  .translate(width / 2, height / 2)
                    .scale(fitToScale)
                    .translate(translateX, translateY),
            );
    }
};

export const drawZoomButtons = (
    baseSvg: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>,
    width: number,
    height: number,
    nodes: ChartNode[],
    zoom:  d3.ZoomBehavior<SVGSVGElement , unknown>
) => {
    const buttonTypes = ["zoomFit","zoomOut","zoomIn"];
    const buttonMargin = 5;
    const buttonWidthHeight = 30;

    const buttonsGroup = baseSvg.select(".buttonsGroup")
        .selectAll(".buttonGroup")
        .data(buttonTypes)
        .join((group) => {
            const enter = group.append("g").attr("class", "buttonGroup");
            enter.append("rect").attr("class", "buttonRect");
            enter.append("text").attr("class", "fa fa-strong buttonIcon");
            return enter;
        });

    buttonsGroup.attr("transform",(d,i) => `translate(${width - buttonWidthHeight - buttonMargin - (i * (buttonWidthHeight + buttonMargin))},${height - buttonMargin - buttonWidthHeight})`)
        .on("click", (event, d) => {
            performZoomAction({
                baseSvg,
                nodes,
                height,
                width,
                transitionTime: 500,
                zoomAction: d,
                zoom
            })
        })

    buttonsGroup.select(".buttonRect")
        .attr("cursor","pointer")
        .attr("width", buttonWidthHeight)
        .attr("height", buttonWidthHeight)
        .attr("fill", "white")
        .attr("stroke", COLORS.grey)
        .attr("stroke-width", 0.5)
        .attr("rx", 3)
        .attr("ry",3)


    buttonsGroup.select(".buttonIcon")
        .attr("pointer-events", "none")
        .attr("fill", "#A0A0A0")
        .attr("text-anchor", "middle")
        .style("font-size", `${buttonWidthHeight * 0.6}px`)
        .attr("x", buttonWidthHeight/2)
        .attr("y", buttonWidthHeight * 0.7)
        .text((d) =>  ICONS[d as keyof typeof ICONS] ||"");
}

export const trimPathToRadius = (
    pathD: string,
    sourceRadius: number = 0,
    targetRadius: number = 0
): string => {
    const svgNS = "http://www.w3.org/2000/svg";

    // Create a temporary SVG path element
    const tempPath = document.createElementNS(svgNS, "path");
    tempPath.setAttribute("d", pathD);

    // Append to DOM temporarily to allow length measurement
    document.body.appendChild(tempPath);

    const totalLength = tempPath.getTotalLength();

    // Ensure radii are within bounds
    const trimStart = Math.min(sourceRadius, totalLength);
    const trimEnd = Math.max(totalLength - targetRadius, trimStart);
    const startPoint = tempPath.getPointAtLength(trimStart);
    const endPoint = tempPath.getPointAtLength(trimEnd);

    // Remove the temporary path from the DOM
    document.body.removeChild(tempPath);

    // Return a new line path
    return `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`;
}




const getTreeData = (networks: { id: string, data: Network}[]) => networks.reduce((acc, entry) => {
        const depthGroup = Array.from(d3.group(entry.data.nodes, (g) => g.nodeDepth));

        const networkChildren = depthGroup.reduce((dataAcc, dataEntry) => {
            dataAcc.push({
                name: `depth${dataEntry[0]}`,
                description: "",
                value: dataEntry[1].length,
                data: dataEntry[1]
            });
            return dataAcc;
        }, [] as TreeData[]);
        acc.push({
            name: entry.id,
            description: entry.data.network_desc,
            children: networkChildren,
            value: d3.sum(networkChildren, (s) => s.value)
        });
        return acc;
    }, [] as TreeData[])

export const getVoronoi = (rootChildren: TreeData[], dataPoints:[number, number][]) => {
    const value = d3.sum(rootChildren, (s) => s.value);
    const root = d3.hierarchy<TreeData>({
        name: "root",
        children: rootChildren,
        description: "root",
        value
    })
        .sum((s) => s.value);

    const rng = seedrandom('40');
    const voronoiTreemapInstance = voronoiTreemap().prng(rng).clip(dataPoints);

    voronoiTreemapInstance(root);

    return root.descendants().filter((f) => f.depth > 0) as VoronoiNode<TreeData>[];
}

function offsetPolygon(polygon: [number, number][], padding: number) {

    const scale = 1000; // Clipper requires integer coordinates
    const scaled = polygon.map(([x, y]) => ({ X: x * scale, Y: y * scale }));

    const clipper = new ClipperLib.ClipperOffset();
    clipper.AddPath(scaled, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);

    const offsetted: {X: number, Y: number}[][] = [];
    clipper.Execute(offsetted, -padding * scale); // Negative = inward

    if(!offsetted || offsetted.length === 0){
        clipper.Execute(offsetted, -(padding/2) * scale); // Negative = inward
    }
    // Convert back to original scale
    return offsetted[0].map(({ X, Y}) => [X / scale, Y / scale]) as [number,number][];
}


export const drawVoronoiTree = (
    svg: d3.Selection<BaseType, unknown, HTMLElement, unknown>,
    currentNetworks: { id: string, data: Network}[],
    architectureLinks: ChartLink[],
    chartWidth: number,
    chartHeight: number,
    margins: {[key: string] : number},
    containerClass: string,
    chainContainerClass: string,
    simulation: d3.Simulation<NetworkNode, NetworkLink>
) => {
    const gapFill = "#F0F0F0";
    const networkFill = "white";

    const treeData = getTreeData(currentNetworks);

    const chartPath: [number, number][] = [
        [0, 0],
        [chartWidth, 0],
        [chartWidth, chartHeight],
        [0, chartHeight]
    ];

    const allNodes = getVoronoi(treeData, chartPath);

    const networkNodes = allNodes
        .filter((f) => f.depth === 2)
        .reduce((acc, entry) => {
            const network = entry.parent === null ? "" : entry.parent.data.name;
            if(entry.data.data){
                entry.data.data.forEach((node: ChartNode) => {
                    acc.push({
                        network,
                        centreX: entry.polygon.site.x,
                        centreY: entry.polygon.site.y,
                        polygon: entry.polygon,
                        node
                    })
                })
            }
            return acc;
        },[] as NetworkNode[]);

    const {nodeRadius, labelFontSize} = getNodeRadiusAndLabelSize(chartWidth,chartHeight,networkNodes.length)

    networkNodes.map((m) => m.radius = nodeRadius);

    const networkLinks = currentNetworks.reduce((acc,entry) => {
        entry.data.links.forEach((link) => {
            acc.push({
                source: link.source,
                target: link.target,
                type: link.type,
                id: link.id
            })
        })
        return acc;
    },[] as NetworkLink[])
        .concat(architectureLinks.filter((f) =>
            networkNodes.some((s) => s.node.id === f.source) &&
            networkNodes.some((s) => s.node.id === f.target)
        ));


    const linkGroup = svg
        .select(".linksGroup")
        .selectAll(".linkGroup")
        .data(networkLinks)
        .join((group) => {
            const enter = group.append("g").attr("class", "linkGroup");
            enter.append("path").attr("class", "linkPath");
            enter.append("path").attr("class", "linkChainPath");
            return enter;
        });

    linkGroup.attr("transform",`translate(${margins.left},${margins.top})`);

    linkGroup.select(".linkPath")
        .attr("fill","transparent")
        .attr("stroke-width",nodeRadius/10)
        .attr("stroke",COLORS.lightgrey);

    linkGroup.select(".linkChainPath")
        .attr("fill","transparent")
        .attr("stroke-width",0)
        .attr("stroke",COLORS.lightgrey)
        .attr("marker-end",`url(#arrowEndGrey${containerClass})`)

    const nodeGroup = svg
        .select(".nodesGroup")
        .selectAll(".nodeGroup")
        .data(allNodes)
        .join((group) => {
            const enter = group.append("g").attr("class", "nodeGroup");
            enter.append("path").attr("class", "voronoiPath");
            return enter;
        });


    nodeGroup
        .select(".voronoiPath")
        .attr("cursor", "pointer")
        .attr("d", (d) => `M${d.polygon.join(",")}Z`)
        .attr("stroke", gapFill)
        .attr("stroke-width", (d) => (d.depth === 1 ? 10 : 4))
        .attr("fill", (d) => (d.depth > 1 ? "transparent" : networkFill))
        .attr("transform",`translate(${margins.left},${margins.top})`)
        .on("mousemove", (event, d) => {
            const chainGraphSVG = d3.select(`.svg_${chainContainerClass}`);
            if(chainGraphSVG.node()){
                chainGraphSVG.selectAll<SVGPathElement, NetworkNode>(".networkRect")
                    .attr("fill", (n) =>  d.parent && n.network === d.parent.data.name ? COLORS.midgrey : "white")
            }
        })
        .on("mouseout", () => {
            const chainGraphSVG = d3.select(`.svg_${chainContainerClass}`);
            if(chainGraphSVG.node()) {
                chainGraphSVG.selectAll(".networkRect")
                    .attr("fill", "white");
            }
        });

    const voronoiLabelHeight = labelFontSize * 0.95;

    const nodeLabelGroup = svg
        .select(".nodeLabelsGroup")
        .selectAll(".nodeLabelGroup")
        .data(allNodes.filter((f) => f.depth === 1))
        .join((group) => {
            const enter = group.append("g").attr("class", "nodeLabelGroup");
            enter.append("rect").attr("class", "voronoiLabelRect");
            enter.append("text").attr("class", "voronoiLabel");
            return enter;
        });

    nodeLabelGroup.attr("transform",`translate(${margins.left},${margins.top})`);

    nodeLabelGroup
        .select(".voronoiLabelRect")
        .attr("pointer-events", "none")
        .attr("width", (d) =>
            d.children ? measureWidth(d.data.name, labelFontSize) : 0
        )
        .attr("x", (d) => -measureWidth(d.data.name, labelFontSize) / 2)
        .attr("height", (d) => (d.depth > 1 ? 0 : voronoiLabelHeight))
        .attr("y", -voronoiLabelHeight/2)
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("fill", networkFill)
        .attr(
            "transform",
            (d) => `translate(${d.polygon.site.x},${d.polygon.site.y})`
        )
        .text((d) => (d.depth === 1 ? d.data.name : 0));

    nodeLabelGroup
        .select(".voronoiLabel")
        .style("dominant-baseline","middle")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .attr("font-size", labelFontSize)
        .attr(
            "transform",
            (d) =>
                `translate(${d.polygon.site.x},${
                    d.polygon.site.y + voronoiLabelHeight * 0.1
                })`
        )
        .text((d) => d.data.name)
        .attr("fill", COLORS.black);


    const networkNodeGroup = svg
        .select(".networkNodesGroup")
        .selectAll(".networkNodeGroup")
        .data(networkNodes)
        .join((group) => {
            const enter = group.append("g").attr("class", "networkNodeGroup");
            enter.append("circle").attr("class", "networkBackgroundNode");
            enter.append("circle").attr("class", "networkNode");
            enter.append("text").attr("class", "networkNodeLabel");
            enter.append("text").attr("class", "fa networkNodeIcon");
            enter.append("circle").attr("class", "networkChainNode");
            enter.append("text").attr("class", "fa networkChainNodeIcon");
            enter.append("text").attr("class", "networkChainNodeLabel");

            return enter;
        });


    const chainGraphSvg = d3.select(`.svg_${chainContainerClass}`);

    networkNodeGroup.select(".networkChainNode")
        .attr("pointer-events","none")
        .attr("r", CHAIN_CIRCLE_RADIUS)
        .attr("opacity", 0)
        .attr("stroke","gold")
        .attr("stroke-width",0)
        .attr("fill", (d) => NODEFLOW_COLORS[d.node.class as keyof typeof NODEFLOW_COLORS])
        .attr("transform",`translate(${margins.left},${margins.top})`)


    networkNodeGroup.select(".networkNode")
        .attr("r", nodeRadius)
        .attr("fill-opacity", NODE_FILL_OPACITY_START)
        .attr("stroke","gold")
        .attr("stroke-width",0)
        .attr("fill", (d) => NODEFLOW_COLORS[d.node.class as keyof typeof NODEFLOW_COLORS])
        .attr("transform",`translate(${margins.left},${margins.top})`)
        .on("mousemove", (event,d) => {
            if(chainGraphSvg.node()) {

                chainGraphSvg.selectAll<SVGGElement, ChainNode>(".nodeCircle")
                    .attr("stroke-width", (n) =>  n.id === d.node.id
                        ? NODE_HIGHLIGHT_STROKE_WIDTH : 0)
            }

            const searchNodes = chainGraphSvg.selectAll<SVGGElement, ChainNode>(".nodeBackgroundCircle")
                .filter((f,i,objects) => +d3.select(objects[i]).attr("stroke-width") > 0)
                .data()
                .map((m) => m.id)

            svg.selectAll<SVGCircleElement,NetworkNode>(".networkNode")
                .attr("stroke", (n) => n.node.id === d.node.id ? COLORS.darkblue : COLORS.gold)
                .attr("stroke-width",(n) => n.node.id === d.node.id || searchNodes.includes(n.node.id)
                ? NODE_HIGHLIGHT_STROKE_WIDTH : 0);

            const tooltipText = getTooltipText(d.node);
            d3.select("#mainChartTooltip")
                .style("visibility","visible")
                .style("left",`${event.offsetX + CHAIN_CIRCLE_RADIUS + 5}px`)
                .style("top",`${event.offsetY - 10}px`)
                .html(tooltipText);
        })
        .on("mouseout", () => {
            if(chainGraphSvg.node()) {
                chainGraphSvg.selectAll<SVGGElement, ChainNode>(".nodeCircle")
                    .attr("stroke",  "gold")
            }
            const searchNodes = chainGraphSvg.selectAll<SVGGElement, ChainNode>(".nodeBackgroundCircle")
                .filter((f,i,objects) => +d3.select(objects[i]).attr("stroke-width") > 0)
                .data()
                .map((m) => m.id);


            svg.selectAll<SVGCircleElement,NetworkNode>(".networkNode")
                .attr("stroke", "gold")
                .attr("stroke-width", (n) => searchNodes.includes(n.node.id) ? NODE_HIGHLIGHT_STROKE_WIDTH : 0);
                d3.select("#mainChartTooltip")
                .style("visibility","hidden")

        });

    networkNodeGroup.select(".networkChainNodeIcon")
        .attr("pointer-events","none")
        .attr("opacity", 0)
        .attr("fill", "white")
        .attr("text-anchor","middle")
        .attr("font-size", CHAIN_CIRCLE_RADIUS)
        .style("dominant-baseline","middle")
        .attr("dy",-CHAIN_CIRCLE_RADIUS * 0.05)
        .text((d) => NODETYPE_ICONS[d.node.type as keyof typeof NODETYPE_ICONS])
        .attr("transform",`translate(${margins.left},${margins.top})`);


    networkNodeGroup.select(".networkNodeIcon")
        .attr("pointer-events","none")
        .attr("visibility", "hidden")
        .attr("fill", "white")
        .attr("text-anchor","middle")
        .attr("font-size", nodeRadius)
        .style("dominant-baseline","middle")
        .attr("dy",-nodeRadius * 0.05)
        .text((d) => NODETYPE_ICONS[d.node.type as keyof typeof NODETYPE_ICONS])
        .attr("transform",`translate(${margins.left},${margins.top})`);

    networkNodeGroup.select(".networkNodeLabel")
        .attr("pointer-events","none")
        .attr("visibility", "hidden")
        .attr("fill", COLORS.black)
        .attr("text-anchor","middle")
        .attr("font-size", NODE_FONT_SIZE_START)
        .style("dominant-baseline","middle")
        .attr("dy",nodeRadius + (NODE_FONT_SIZE_START * 0.65))
        .text((d) => d.node.id.split("-")[0])
        .attr("transform",`translate(${margins.left},${margins.top})`);

    networkNodeGroup.select(".networkChainNodeLabel")
        .attr("pointer-events","none")
        .attr("opacity", 0)
        .attr("fill", COLORS.black)
        .attr("text-anchor","middle")
        .attr("font-size", 10)
        .style("dominant-baseline","middle")
        .attr("dy",CHAIN_CIRCLE_RADIUS + (10 * 0.65))
        .text((d) => d.node.id.split("-")[0])
        .attr("transform",`translate(${margins.left},${margins.top})`);

    simulation
        .on("tick", () => {

        svg.selectAll<SVGGElement,NetworkNode>(".networkNodeGroup")
            .attr("transform", (d) => {
                const smallerPolygon = offsetPolygon(d.polygon, nodeRadius * 2.75);
                const withinPolygon = d3.polygonContains(smallerPolygon,[d.x || 0, d.y || 0]);
                if(withinPolygon){
                    d.previousX = d.x;
                    d.previousY = d.y;
                } else {
                    d.x = d.previousX || d.centreX;
                    d.y = d.previousY || d.centreY;
                }
                return `translate(${d.x},${d.y})`;
            });

        svg.selectAll<SVGPathElement,NetworkLink>(".linkPath")
            .attr("d",(d) => {
                if(typeof d.source === "string" || typeof d.target === "string") return "";
                const originalPath = `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
                return trimPathToRadius(originalPath,nodeRadius,nodeRadius)
            })

        svg.selectAll<SVGPathElement,NetworkLink>(".linkChainPath")
            .attr("d",(d) => {
                if(typeof d.source === "string" || typeof d.target === "string") return "";
                const originalPath = `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
                return trimPathToRadius(originalPath,CHAIN_CIRCLE_RADIUS,CHAIN_CIRCLE_RADIUS)
            })
    })


    // reset the simulation
    simulation.nodes([]);
    simulation.nodes(networkNodes);
    const linkForce = simulation.force("link") as d3.ForceLink<NetworkNode,NetworkLink>;
    if(linkForce){
        linkForce.links([]);
        linkForce.links(networkLinks);
    };

    simulation.stop();
    simulation.alphaDecay(0.05)
    simulation.alpha(1).restart();

}


