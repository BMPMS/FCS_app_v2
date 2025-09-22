import {ArcRoute, ChainLink, ChainNode, ChartLink, ChartNode, Network, NetworkLink, NetworkNode} from "@/types/data";
import Graph from "graphology";
import {getLinkId, rgbStringToHex} from "@/app/components/sharedFunctions";
import {Attributes} from "graphology-types";
import * as d3 from "d3";
import {COLORS, NODEFLOW_COLORS, NODETYPE_ICON_NAMES, NODETYPE_ICONS} from "@/app/components/MainForceChart";
import {trimPathToRadius} from "@/app/components/MainForceChart_functions";
import {CHAIN_CIRCLE_RADIUS, NODE_HIGHLIGHT_STROKE_WIDTH} from "@/app/components/ChainForceChart";
import {DirectedGraph} from 'graphology';
import {HierarchyEntry} from "@/app/components/ChainHierarchyChart_functions";

export const handleAnimationFlow = (
    svg:d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>,
    transitionTime: number,
    containerClass: string,
    mainContainerClass: string,
    nodeAnimations: ChainNode[],
    pathAnimations: ChainLink[],
    searchNodes: string[],
    currentGraph: Graph<Attributes,Attributes,Attributes>
) => {



    const finalNodeAnimations: ChainNode[] = [];
    let excludeNodes: string[] = [];
    // need to add logic here
    nodeAnimations
        .forEach((d) => {
            // don't apply to starting nodes
            if(excludeNodes.some((s) => s === d.id)){
                // do nothing
            } else if (!searchNodes.some((s) => s === d.id)) {
                const chainNode = d;
                if(chainNode){
                    const chainInBoundStandardLinks = pathAnimations.filter(
                        (f) => getLinkId(f,"target") === chainNode.id && f.type === "standard"
                    );
                    const chainInBoundSuppressLinks = pathAnimations.filter(
                        (f) => getLinkId(f, "target") === chainNode.id && f.type === "suppress"
                    );
                    const allInBoundLinks = currentGraph
                        .inEdges(chainNode.id)  // get incoming edge keys to nodeId
                        .reduce((acc, edgeKey) =>  {
                            acc.push({
                                id: edgeKey,
                                source: currentGraph.source(edgeKey),
                                target: currentGraph.target(edgeKey),
                                type: currentGraph.getEdgeAttribute(edgeKey, 'type')
                            })
                            return acc;
                            }, [] as ChainLink[]);


                    if (chainNode.type === "any" && chainInBoundStandardLinks.length === 0) {
                        chainNode.fail = true;
                    } else if (chainNode.type === "all") {
                        if (chainInBoundStandardLinks.length !== allInBoundLinks.length) {
                            chainNode.fail = true;
                        }
                    } else if (chainNode.type === "suppression") {
                        const allStandardLinks = allInBoundLinks.filter(
                            (f) => f.type === "standard"
                        );
                        //all standard links must be active
                        if (allStandardLinks.length !== chainInBoundStandardLinks.length) {
                            chainNode.fail = true;
                        } else {
                            const allSuppressionLinks = allInBoundLinks.filter(
                                (f) => f.type === "suppress"
                            );
                            const allNonSuppressionLinks = allInBoundLinks.filter(
                                (f) => f.type !== "suppress"
                            );
                            //not all suppression links must be active
                            if (allSuppressionLinks.length === chainInBoundSuppressLinks.length) {
                                chainNode.fail = true;
                            } else if (allNonSuppressionLinks.length !== chainInBoundStandardLinks.length) {
                                chainNode.fail = true;
                            }
                        }
                    }
                    let currentOutNeighbours =  currentGraph.outboundNeighbors(chainNode.id);
                    if(!chainNode.fail) {
                        // add current
                        currentOutNeighbours.push(chainNode.id);
                        currentOutNeighbours.forEach((r) => {
                            const matchingNAnimation: ChainNode | undefined = nodeAnimations.find((f) => f.id === r);
                            if(matchingNAnimation && !finalNodeAnimations.some((s) => s.id === r)){
                                finalNodeAnimations.push(matchingNAnimation);
                            }
                       })
                    } else {
                        const allNodes = new Set<string>();
                        currentOutNeighbours.forEach((d) => allNodes.add(d));
                        let newNeighbours: string[] = [];
                        while (currentOutNeighbours.length > 0) {
                            currentOutNeighbours.forEach((neighbour) => {
                                allNodes.add(neighbour);
                                const currentOutbound = currentGraph.outboundNeighbors(neighbour);
                                currentOutbound.forEach((outbound) => {
                                    if (!allNodes.has(outbound) && !newNeighbours.includes(outbound)) {
                                        newNeighbours.push(outbound);
                                    }
                                });
                            });
                            currentOutNeighbours = newNeighbours;
                            newNeighbours = [];
                        }

                        const currentNodeChain = Array.from(allNodes);

                        // add fail node but no subsequent
                       if (!finalNodeAnimations.some((s) => s.id === chainNode.id)) {
                            finalNodeAnimations.push(d);
                        }

                       excludeNodes = [...new Set(excludeNodes.concat(currentNodeChain))]
                    }
                }
            } else {
                // add all starting nodes
                if (!finalNodeAnimations.some((s) => s.id === d.id)) {
                    finalNodeAnimations.push(d);
               }
            }
        });

    const remainingNodes = finalNodeAnimations.map((m) => m.id);
   const finalPathAnimations =         pathAnimations.filter(
        (f) =>
            remainingNodes.includes(getLinkId(f,"source")) && remainingNodes.includes(getLinkId(f, "target")))


    animateNodes(svg, finalNodeAnimations,transitionTime, mainContainerClass);
    animatePaths(svg, finalPathAnimations,transitionTime,containerClass);

}

const animateNodes = (
    svg:d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>,
    animateNodes : ChainNode[],
    transitionTime: number,
    mainContainerClass: string
) => {

    const sortedAnimateNodes = animateNodes
        .sort((a,b) => d3.ascending(a.depth,b.depth));
    const mainGraphSvg = d3.select(`.svg_${mainContainerClass}`);
    if(mainGraphSvg.node() ) {
        // hide all chain links and grey out all chain nodes
        mainGraphSvg.selectAll(".networkChainNode")
            .attr("fill",COLORS.lightgrey);
        mainGraphSvg.selectAll(".linkChainPath")
            .attr("opacity", 0)


        sortedAnimateNodes.forEach((d,i) => {
            const currentDelay = -300 + (d.depth + 1) * transitionTime;

            mainGraphSvg.selectAll<SVGGElement,NetworkNode>(".networkChainNode")
                .filter((f) => f.node.id === d.id)
                .transition()
                .delay(currentDelay)
                .duration(transitionTime * 0.8)
                .attr("fill",(n) => NODEFLOW_COLORS[n.node.class as keyof typeof NODEFLOW_COLORS])

            if(i < (sortedAnimateNodes.length - 1)){
                mainGraphSvg.selectAll<SVGGElement,NetworkLink>(".linkChainPath")
                    .filter((f) => typeof f.source !== "string" && f.source.node.id === d.id)
                    .transition()
                    .delay(currentDelay)
                    .duration(transitionTime * 0.8)
                    .attr("opacity", 1)
                    .attr("stroke",COLORS.midgreen)
                    .attr("marker-end",`url(#arrowEndGreen${mainContainerClass})`);
            }
        })

    }

        d3.selectAll(".nodeCircleIcon").attr("opacity",1);
    d3.selectAll(".nodeCircle").attr("fill",COLORS.midgrey);
    d3
        .selectAll<SVGCircleElement, ChainNode>(".nodeCircle")
        .attr("opacity",1)
        .filter((f) => animateNodes.some((s) => s.id === f.id))
        .transition()
        .delay(
            (d) => {
                const matchingAnimateNode = animateNodes.find((f) => f.id === d.id);
                if (matchingAnimateNode) {
                    d.fail = matchingAnimateNode.fail;
                    return -300 + (matchingAnimateNode.depth + 1) * transitionTime
                }
                return 0;
            }
        )
        .duration(transitionTime * 0.8)
        .attr("fill", (n) => getNodeCircleFill(n,  animateNodes.map((m) => m.id),true));

}

const animatePaths = (
    svg:d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>,
    animatePaths: ChainLink[],
    transitionTime: number,
    containerClass: string) => {

    const linksToAnimate = d3
        .selectAll<SVGPathElement,ChartLink>(".linkLine")
        .filter((f) => animatePaths.some((s) => s.id === f.id ||
            (getLinkId(f,"source") === getLinkId(s,"source") &&
                getLinkId(f,"target") === getLinkId(s,"target")) ))


   linksToAnimate
        .each((d) => {
            const linkPath = d3.select<SVGPathElement,ChartLink>(`#linkPath${d.id}`);
            const linkPathNode = linkPath?.node();
            if(linkPathNode !== null){
                const totalLength = linkPathNode.getTotalLength();
                const animatePath = d3.select<SVGPathElement, ChartLink>(`#linkAnimatePath${d.id}`);
                if (animatePath.node()) {
                    animatePath
                        .attr("stroke-opacity", 1)
                        .attr("stroke-dasharray", totalLength)
                        .attr("stroke-dashoffset", totalLength)
                        .transition()
                        .delay(
                            (l) => {
                                const matchingAnimatePath = animatePaths.find((f) => f.id === l.id ||
                                    (getLinkId(f,"source") === getLinkId(l,"source") &&
                                        getLinkId(f,"target") === getLinkId(l,"target")));
                                if(matchingAnimatePath){
                                    const sourceDepth = typeof matchingAnimatePath.source === "string" ? 1 : matchingAnimatePath.source.depth
                                    return transitionTime * sourceDepth;
                                }
                                return 0
                            }
                        )
                        .duration(transitionTime - 100)
                        .ease(d3.easeLinear)
                        .attrTween("stroke-dashoffset", function () {
                            return t => d3.interpolateNumber(totalLength, 0)(t).toString();
                        })
                        .transition()
                        .duration(0)
                        .attr("stroke-dasharray", (p) =>
                            p.type === "suppress" ? "4,4" : ""
                        );
                }
            }
        });

   linksToAnimate
        .transition()
        .delay(transitionTime)
        .duration(100)
        .attr("stroke","transparent")
        .attr("marker-end", (d) => `url(#arrowEnd${d.type === "suppress" ? "Red" : "Green"}${containerClass})`)
        //  .attr("marker-end", (networks.json) => getMarker(networks.json,"end",networks.json.type === "suppress" ? "Red" : "Green",containerClass))
}

export const measureWidth = (text: string, fontSize: number) => {
    const context = document.createElement("canvas").getContext("2d");
    if(context){
        context.font = `${fontSize}px Arial`;
        return context.measureText(text).width;
    }
    return 0;
}

const getAllConnectedNodes = (
    graph:  Graph<Attributes, Attributes, Attributes>,
    nodeId: string,
    direction = 'descendants',
    visited = new Set(),
    depth: number,
    depthMapper: {[key: string]:number }) => {

    visited.add(nodeId);
    depthMapper[nodeId] = depth;

    // Choose neighbors based on direction
    const neighbors =
        direction === 'descendants'
            ? graph.outNeighbors(nodeId)
            : direction === 'ancestors'
                ? graph.inNeighbors(nodeId)
                : [];

    neighbors.forEach(neighbor => {
        getAllConnectedNodes(graph, neighbor, direction, visited, depth + 1, depthMapper);
    });

    return visited;
}

export const buildDataGraph = (networks: Network[], routes: ArcRoute[]) => {
    const graph = new Graph();

    networks.forEach((network) => {
        network.nodes.forEach((node) => graph.addNode(node.id, {
            type: node.type,
            class: node.class,
            desc: node.desc,
            network: network.network
        }));
        network.links.forEach((link) => graph.addEdge(
            getLinkId(link,"source"),
            getLinkId(link,"target"),
            {
                type: link.type
            }
        ));
    })
    routes.forEach((route) => {
        const sourceNodeId = `${route.source_node}-${route.source_net}`;
        const targetNodeId = `${route.dest_node}-${route.dest_net}`;
        if(!graph.hasNode(sourceNodeId)){
            console.log(`${sourceNodeId} - link but no node`)
        } else if(!graph.hasNode(targetNodeId)){
            console.log(`${targetNodeId} - link but no node`)
        } else {
            graph.addEdge(sourceNodeId,targetNodeId,{
                type: "standard"
            });
        }
    })
    return graph;
}
export const getNodeChain = (
    graph:  Graph<Attributes, Attributes, Attributes>,
    searchNodes: string[],
    searchDirection: string) => {

    const allNodes: ChainNode[] = [];
    const allLinks: ChainLink[] = [];

    searchNodes.forEach((nodeId) => {
        const allNodeIds = new Set<string>();
        const depthMapper: {[key: string]:number } = {};
        getAllConnectedNodes(graph,nodeId,"descendants",allNodeIds, 0, depthMapper);
      //  getAllConnectedNodes(graph,nodeId,"ancestors",allNodeIds, 0, depthMapper);

        graph.forEachEdge((edge, attr, source, target) => {
            if (allNodeIds.has(source) && allNodeIds.has(target)) {
                if(!allLinks.some((s) => s.id === edge)){
                    allLinks.push({
                        id: edge,
                        source: searchDirection === "input" ? source : target,
                        target: searchDirection === "input" ? target : source,
                        type: graph.getEdgeAttribute(edge, "type") });
                }
                }
        });
        Array.from(allNodeIds).forEach((chainNodeId) => {
            if(!allNodes.some((s) => s.id === chainNodeId)){
                allNodes.push({
                    id: chainNodeId,
                    type: graph.getNodeAttribute(chainNodeId, "type"),
                    class: graph.getNodeAttribute(chainNodeId, "class"),
                    desc: graph.getNodeAttribute(chainNodeId, "desc"),
                    network: graph.getNodeAttribute(chainNodeId, "network"),
                    depth: depthMapper[chainNodeId]
                })
            }
        })

    })

    return {allNodes,allLinks};
}

const getNodeCircleFill = (node: ChainNode,  flowModeSelectedNodes: string[], flowMode: boolean) => {

    if(!flowMode) return NODEFLOW_COLORS[node.class as keyof typeof NODEFLOW_COLORS];
    if (flowModeSelectedNodes && flowModeSelectedNodes.length > 0 && node.fail) return NODEFLOW_COLORS["failedOutput"];
    if (flowModeSelectedNodes && !flowModeSelectedNodes.includes(node.id))
        return COLORS.midgrey;
    if (node.class !== "output") return NODEFLOW_COLORS[node.class as keyof typeof NODEFLOW_COLORS];

    return NODEFLOW_COLORS["successfulOutput"];
}

const getNodeOpacity = (d: ChainNode, nodeSelection: string[], isMouseover: boolean) => {
    if(nodeSelection.length === 0 && !isMouseover) return 1;
    if(nodeSelection.includes(d.id)){
        return 1;
    }
    return 0.2;
}

export const getChainAncestors = (nodeId: string, nodes: ChainNode[], links: ChainLink[]) => {
    const graph = new DirectedGraph();


    nodes.forEach((node) => graph.addNode(node.id));
    links
        .forEach((link) => {
            if(typeof link.source === "string") return;
            if(typeof link.target === "string") return;
            return graph.addEdge(link.source.id, link.target.id)
        });
    const allInbound = new Set<string>();
    allInbound.add(nodeId);
    let inbound = graph.inboundNeighbors(nodeId);

    while(inbound.length > 0){
        let newInbound: string[] = [];
        inbound.forEach((d) => {
            allInbound.add(d);
            newInbound = newInbound.concat(graph.inboundNeighbors(d))
        });
        inbound = newInbound;
    }
    return Array.from(allInbound);
}

export const getTooltipText = (node: ChainNode | ChartNode | HierarchyEntry) => {
    const iconClass = NODETYPE_ICON_NAMES[node.type as keyof typeof NODETYPE_ICON_NAMES];
    const classColor = NODEFLOW_COLORS[node.class as keyof typeof NODEFLOW_COLORS];

    const {0: id, 1: network} = (node.id || "").split("-")
    let tooltipText = `<strong>${id}</strong><br>`;
    tooltipText += `<span style="color: ${COLORS.darkgrey}">network:</span> ${network}<br>`;
    tooltipText += `<span style="color: ${classColor}; font-weight: bolder;"> ${node.class}</span><br>`;
    tooltipText += `<span style="color: ${COLORS.darkgrey}">type:</span> <i class='${iconClass}'></i>`
    tooltipText += ` ${node.type}<br>`;
    if(node.type === "comp"){
        const alteredDesc = (node.desc || "")
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/\\n/g,'<br>');
        tooltipText += `<br><span style="color: ${COLORS.darkgrey}"><pre><code>${alteredDesc}</code></pre></span>`
    } else {
        tooltipText += `<span style="color: ${COLORS.darkgrey}"><i>${node.desc}</i></span>`
    }
    return tooltipText;

}

export const getAllChainAncestors = (
    graph:  Graph<Attributes, Attributes, Attributes>,
    nodeId: string,
    currentAncestors: string[]
    ) => {
    const allInbound = new Set<string>();
    let inbound = graph.inboundNeighbors(nodeId)
        .filter((f) => !currentAncestors.includes(f));

    while(inbound.length > 0){
        let newInbound: string[] = [];
        inbound.forEach((d) => {
            allInbound.add(d);
            newInbound = newInbound.concat(graph.inboundNeighbors(d))

        });
        inbound = newInbound
            .filter((f) => !currentAncestors.includes(f));
    }
    return Array.from(allInbound);
}
export const drawChainForce = (
    svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>,
    nodes: ChainNode[],
    links: ChainLink[],
    simulation:  d3.Simulation<d3.SimulationNodeDatum, undefined>,
    searchNodes: string[],
    containerClass: string,
    mainContainerClass: string,
    currentGraph: Graph<Attributes, Attributes, Attributes>,
    svgHeight: number
) => {
    const flowModeSelectedNodes: string[] = [];
    const flowMode = false;
    const selectedNodes: string[] = [];

    // links group (just a line but you could add labels etc.)
    const linksGroup = svg
        .select(".linkGroup")
        .selectAll<SVGGElement,ChartLink>(".linksGroup")
        .data(links)
        .join((group) => {
            const enter = group.append("g").attr("class", "linksGroup");
            enter.append("path").attr("class", "linkLine");
            enter.append("path").attr("class", "linkAnimatePath");
            return enter;
        });

    linksGroup
        .select(".linkLine")
        .attr("id", (d) => `linkPath${d.id}`)
        .attr("pointer-events","none")
        .attr("stroke-width", 0.75)
        .attr("fill","none")
        .attr("stroke",  (d) => d.type === "architecture" ? "#D0D0D0": "#808080")
        .attr("stroke-dasharray", (d)=>  d.type === "suppress" ? "4,2" :"")

    linksGroup
        .select(".linkAnimatePath")
        .attr("id", (d) => `linkAnimatePath${d.id}`)
        .attr("stroke-width",  1.5)
        .attr("fill","none")
        .attr("stroke-opacity", 0)
        .attr("stroke", (d) =>
            d.type === "suppress"
                ? NODEFLOW_COLORS.suppressedLink
                : NODEFLOW_COLORS.successfulLink
        )

    // nodes group (just a circle but you could add labels etc.)
    const nodesGroup = svg
        .select(".nodeGroup")
        .selectAll<SVGGElement,ChainNode[]>(".nodesGroup")
        .data(nodes)
        .join((group) => {
            const enter = group.append("g").attr("class", "nodesGroup");
            enter.append("circle").attr("class", "nodeBackgroundCircle");
            enter.append("circle").attr("class", "nodeCircle");
            enter.append("text").attr("class", "fa fa-strong nodeCircleIcon");
            enter.append("path").attr("class", "nodeLabelPath");
            enter
                .append("text")
                .attr("class", "nodeCircleLabel")
                .append("textPath")
                .attr("class", "nodeLabelTextPath");
            return enter;
        });

    // transparent path for label
    nodesGroup
        .select(".nodeLabelPath")
        .attr("pointer-events","none")
        .attr("fill", "transparent")
        .attr("id", (d) => `labelCircle${d.id}`)
        .attr("d",
            d3.arc()({
                innerRadius: CHAIN_CIRCLE_RADIUS + 8 ,
                outerRadius: CHAIN_CIRCLE_RADIUS +  8  ,
                startAngle: -Math.PI,
                endAngle: Math.PI
            }))
    
    // label
    nodesGroup
        .select(".nodeLabelTextPath")
        .attr("pointer-events","none")
        .attr("opacity", (d) => searchNodes.includes(d.id) ? 1 : 0)
        .attr("startOffset", "25%")
        .style("letter-spacing","-0.5px")
        .attr("font-size", 11)
        .attr("text-anchor", "middle")
        .attr("xlink:href", (d) => `#labelCircle${d.id}`)
        .text((d) =>  d.id.split("-")[0] );

    const mainGraphSvg = d3.select(`.svg_${mainContainerClass}`);

    nodesGroup.on("mousemove", (event, d) => {
        const ancestors = getChainAncestors(d.id,nodes, links);
        let currentFill = d3.select(event.currentTarget).select(".nodeCircle").attr("fill");
        if(currentFill.includes("rgb")){
            currentFill = rgbStringToHex(currentFill);
        }
        let allAncestors: string[] = [];
        if(currentFill === COLORS.red){
            allAncestors = getAllChainAncestors(currentGraph,d.id,ancestors);
        }

        if(mainGraphSvg.node()) {


            mainGraphSvg.selectAll<SVGCircleElement, NetworkNode>(".networkChainNode")
                .attr("opacity",(n) => allAncestors.includes(n.node.id) || ancestors.includes(n.node.id) ?  1 : 0)
                .attr("fill", (n) => allAncestors.includes(n.node.id) ? COLORS.gold :
                    NODEFLOW_COLORS[n.node.class as keyof typeof NODEFLOW_COLORS])
                .attr("stroke-width", (n) => n.node.id === d.id || searchNodes.includes(n.node.id)? NODE_HIGHLIGHT_STROKE_WIDTH : 0)
                .attr("stroke", (n) => searchNodes.includes(n.node.id)? COLORS.gold : COLORS.darkblue)

            mainGraphSvg.selectAll<SVGCircleElement, NetworkNode>(".networkChainNodeIcon")
                .attr("opacity",(n) => allAncestors.includes(n.node.id) || ancestors.includes(n.node.id) ?  1 : 0)

            mainGraphSvg.selectAll<SVGCircleElement, NetworkNode>(".networkChainNodeLabel")
                .attr("opacity",(n) => allAncestors.includes(n.node.id)  ?  1 : 0)

            mainGraphSvg.selectAll<SVGGElement, NetworkNode>(".networkNodeGroup")
                .attr("opacity", (n) => allAncestors.includes(n.node.id) || ancestors.includes(n.node.id) ? 1 :
                   0)

            mainGraphSvg.selectAll<SVGCircleElement, NetworkNode>(".linkPath").attr("opacity",0);

            mainGraphSvg.selectAll<SVGPathElement, NetworkLink>(".linkChainPath")
                .attr("opacity",(l) => {
                    if(typeof l.source === "string" || typeof l.target === "string") return 0
                    const sourceAndTargetAncestors = ancestors.includes(l.source.node.id) && ancestors.includes(l.target.node.id);
                    const sourceAndTargetAllAncestors = allAncestors.includes(l.source.node.id) && allAncestors.includes(l.target.node.id);
                    return sourceAndTargetAncestors || sourceAndTargetAllAncestors ? 1 : 0;
                })
                .attr("stroke-width",(l) => {
                    if(typeof l.source === "string") return 0;
                    if(typeof l.target === "string") return 0;
                    const sourceAndTargetAncestors = ancestors.includes(l.source.node.id) && ancestors.includes(l.target.node.id);
                    const sourceAndTargetAllAncestors = allAncestors.includes(l.source.node.id) && allAncestors.includes(l.target.node.id);
                    return sourceAndTargetAncestors || sourceAndTargetAllAncestors ? CHAIN_CIRCLE_RADIUS/10 : 0;
                })
        }

        svg.selectAll<SVGTextPathElement,ChainNode>(".nodeLabelTextPath")
            .attr("opacity", (n) => ancestors.includes(n.id) && n.id !== d.id? 1 : 0);

        svg.selectAll<SVGPathElement,ChainLink>(".linkLine")
            .attr("opacity",(l) => {
                if(typeof l.source === "string") return 0;
                if(typeof l.target === "string") return 0;
                return ancestors.includes(l.source.id) && ancestors.includes(l.target.id) ? 1 : 0;
            })

        svg.selectAll<SVGCircleElement, ChainNode>(".nodeBackgroundCircle")
            .attr("opacity",(n) => ancestors.includes(n.id) ? 1 : 0)


        svg.selectAll<SVGCircleElement, ChainNode>(".nodeCircle")
            .attr("opacity",(n) => ancestors.includes(n.id) ? 1 : 0)
            .attr("stroke-width",(n) => n.id === d.id ? NODE_HIGHLIGHT_STROKE_WIDTH : 0);


        const tooltipText = getTooltipText(d);
        const tooltipLineCount = tooltipText.split("<br>").length;
        let tooltipY = event.layerY - (tooltipLineCount* 7);
        if((tooltipY + (tooltipLineCount * 14)) > (svgHeight * 0.8)){
            tooltipY = event.layerY - (tooltipLineCount* 14)
        }

        d3.select("#chainChartTooltip")
            .style("visibility","visible")
            .style("left",`${event.layerX + CHAIN_CIRCLE_RADIUS + 5}px`)
            .style("top",`${tooltipY}px`)
            .html(tooltipText)
    })
        .on("mouseout",(event,d) => {
            if(mainGraphSvg.node()) {
                const ancestors = getChainAncestors(d.id,nodes, links);
                mainGraphSvg.selectAll<SVGCircleElement, NetworkNode>(".networkChainNodeIcon")
                    .attr("opacity",(n) =>  ancestors.includes(n.node.id) ?  1 : 0)

                mainGraphSvg.selectAll<SVGCircleElement, NetworkNode>(".networkChainNode")
                    .attr("opacity",(n) =>  ancestors.includes(n.node.id) ?  1 : 0)
                    .attr("stroke",COLORS.gold)
                    .attr("stroke-width", (n) => searchNodes.includes(n.node.id) ? 2 : 0)

                mainGraphSvg.selectAll<SVGCircleElement, NetworkNode>(".networkNodeGroup")
                    .attr("opacity", 1);

                mainGraphSvg.selectAll<SVGCircleElement, NetworkNode>(".linkPath")
                    .attr("opacity",1);

                mainGraphSvg.selectAll<SVGCircleElement, NetworkNode>(".networkChainNodeLabel")
                    .attr("opacity",0);


                mainGraphSvg.selectAll<SVGPathElement, NetworkLink>(".linkChainPath")
                    .attr("opacity",1)
                    .attr("stroke-width",(l) => {
                        if(typeof l.source === "string") return 0;
                        if(typeof l.target === "string") return 0;
                        return ancestors.includes(l.source.node.id) && ancestors.includes(l.target.node.id) ? CHAIN_CIRCLE_RADIUS/10 : 0;
                    });
              }

            svg.selectAll<SVGCircleElement, ChainNode>(".nodeBackgroundCircle")
                .attr("opacity",1)

            svg.selectAll<SVGTextPathElement,ChainNode>(".nodeLabelTextPath")
                .attr("opacity", (n) => searchNodes.includes(n.id) ? 1 : 0)

            svg.selectAll<SVGCircleElement,ChainNode>(".nodeCircle")
                .attr("opacity",1)
                .attr("stroke-width",(n) => searchNodes.includes(n.id) ? 2 : 0)
                .attr("stroke", "gold");

            svg.selectAll<SVGPathElement,ChainLink>(".linkLine")
                .attr("opacity", 1);

            d3.select("#chainChartTooltip")
                .style("visibility","hidden")

        })
    nodesGroup
        .select(".nodeBackgroundCircle")
        .attr("r", CHAIN_CIRCLE_RADIUS)
        .attr("fill", "var(--background)")
        .attr("stroke-width",(d) =>  searchNodes.includes(d.id) ? NODE_HIGHLIGHT_STROKE_WIDTH : 0)
        .attr("stroke", "gold")

    nodesGroup
        .select(".nodeCircle")
        .attr("stroke-width",0)
        .attr("stroke", COLORS.darkblue)
        .attr("r", CHAIN_CIRCLE_RADIUS)
        .attr("fill",(d) => getNodeCircleFill(d, flowModeSelectedNodes,flowMode))
       .attr("opacity", (d) => getNodeOpacity(d,selectedNodes, false));

    nodesGroup
        .select(".nodeCircleIcon")
        .attr("font-size", CHAIN_CIRCLE_RADIUS)
        .attr("fill", "white")
        .attr("text-anchor","middle")
        .style("dominant-baseline","middle")
        .attr("opacity", (d) => getNodeOpacity(d,selectedNodes, false))
        .text((d) => NODETYPE_ICONS[d.type as keyof typeof NODETYPE_ICONS]);

    // as the simulation ticks, reposition links and node groups
    simulation.on("tick", () => {
        svg
            .selectAll<SVGLineElement,ChainLink>(".linkLine")
            .attr("d", (d) => {
                const source = (d.source as ChainNode);
                const {x: sourceX, y: sourceY} = source;
                const target =  (d.target as ChainNode);
                const {x: targetX, y: targetY} = target;
                if(!sourceX || !sourceY || !targetX || !targetY) return "";
                const originalPath = `M${sourceX},${sourceY} L${targetX},${targetY}`;
                const {startPoint, endPoint} =  trimPathToRadius(originalPath,CHAIN_CIRCLE_RADIUS,CHAIN_CIRCLE_RADIUS );
                const dx = endPoint.x - startPoint.x;
                const dy = endPoint.y - startPoint.y;
                const dr = Math.sqrt(dx * dx + dy * dy) * 2;
                return `M${startPoint.x},${startPoint.y}A${dr},${dr} 0 0,1 ${endPoint.x},${endPoint.y}`
            })

        svg
            .selectAll<SVGLineElement,ChainLink>(".linkAnimatePath")
            .attr("d", (d) => {
                const source = (d.source as ChainNode);
                const {x: sourceX, y: sourceY} = source;
                const target =  (d.target as ChainNode);
                const {x: targetX, y: targetY} = target;
                if(!sourceX || !sourceY || !targetX || !targetY) return ""
                const originalPath =  `M${sourceX },${sourceY} L${targetX },${targetY }`;
                const {startPoint, endPoint} = trimPathToRadius(originalPath,CHAIN_CIRCLE_RADIUS,CHAIN_CIRCLE_RADIUS + 5);
                const dx = endPoint.x - startPoint.x;
                const dy = endPoint.y - startPoint.y;
                const dr = Math.sqrt(dx * dx + dy * dy) * 2;
                return `M${startPoint.x},${startPoint.y}A${dr},${dr} 0 0,1 ${endPoint.x},${endPoint.y}`
            })

        svg.selectAll<SVGGElement,ChainNode>(".nodesGroup")
            .attr("transform", (d) => `translate(${(d.x || 0) },${(d.y || 0)})`);
    });

    // reset the simulation
    simulation.nodes([]);
    simulation.nodes(nodes);
    const linkForce = simulation.force("link");
    if(linkForce){
        (linkForce as d3.ForceLink<ChainNode,ChainLink>).links([]);
        (linkForce as d3.ForceLink<ChainNode,ChainLink>).links(links);
    }

    simulation.stop();
    simulation.alpha(1).restart();
    simulation.tick(500);

    svg.selectAll<SVGPathElement,ChartLink>(".linkLine")
        .attr("fill","none")
        .attr("stroke",  (d) => d.type === "architecture" ? "#D0D0D0": "#808080")
        .attr("marker-end", `url(#arrowEndGrey${containerClass})`)
}

