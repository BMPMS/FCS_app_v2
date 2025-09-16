import * as d3 from "d3";
import {Network, TreeData, VoronoiNode} from "../../types/data";
import {COLORS} from "@/app/components/MainForceChart";
import {measureWidth} from "@/app/components/ChainForceChart_functions";

export const drawNetworkMap = (
    svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>,
    networkNodes: Network[],
    networkLinks: {source: string, target:string, direction:string}[],
    layerMapper: {[key:string] : number},
    svgWidth: number,
    svgHeight: number,
    containerClass: string,
    mainContainerClass: string,
    labelFontSize: number

) => {


    const layerData = Array.from(d3.group(networkNodes, (g) => layerMapper[g.network]))
        .sort((a,b) => d3.ascending(a[0],b[0]));

    const layerExtent = d3.extent(layerData, (d) => d[0]);
    const yScale = d3.scaleLinear().domain([layerExtent[0] || 0, (layerExtent[1]  || 0) + 1]).range([0,svgHeight])

    const totalLayers = (layerExtent[1] || 0) - (layerExtent[0] || 0);
    const layerHeight = svgHeight/(totalLayers + 1);

    const networkPositions = networkNodes.reduce((acc, entry) => {
        const currentLayer = layerMapper[entry.network];
        const layerGroup = layerData.find((f) => f[0] === currentLayer);
        if(layerGroup){
            const layerCount = layerGroup[1].length;
            const networkGap = svgWidth/(layerCount + 1);
            const layerIndex = layerGroup[1].findIndex((f) => f.network === entry.network);
            if(layerIndex !== undefined){
                const xPos = networkGap + (layerIndex * networkGap);
                const yPos = yScale(currentLayer) + layerHeight/2;
                acc[entry.network] = {x: xPos,y:yPos}
            };
        }
        return acc;
    },{} as {[key: string] : {x: number, y: number}});


    // for each layer within architecture
    const layersGroup = svg.select(".nodeGroup")
        .selectAll(".layerGroup")
        .data(layerData)
        .join((group) => {
            const enter = group.append("g").attr("class", "layerGroup");
            enter.append("line").attr("class", "layerLine");
            enter.append("text").attr("class", "layerLabel");
            enter.append("g").attr("class", "networksGroup");
            return enter;
        });


    layersGroup.select(".layerLine")
        .attr("x1",0)
        .attr("x2",svgWidth)
        .attr("stroke","white")
        .attr("stroke-width",1.5)
        .attr("transform", (d) => `translate(0,${yScale(d[0] || 0)})`)
    ;

    layersGroup.select(".layerLabel")
        .attr("x",5)
        .attr("dy",labelFontSize * 0.7)
        .attr("font-size",labelFontSize * 0.6)
        .attr("fill",COLORS.black)
        .text((d) => d[0] === -1 || d[0] === 4? "Computations" :`Layer ${d[0]}`)
        .attr("transform", (d) => `translate(0,${yScale(d[0] || 0)})`);


    const networkGroup = layersGroup.select(".networksGroup")
        .selectAll<SVGGElement,Network[]>(".networkGroup")
        .data((d) => d[1])
        .join((group) => {
            const enter = group.append("g").attr("class", "networkGroup");
            enter.append("rect").attr("class", "networkRect");
            enter.append("text").attr("class", "networkRectLabel");
            return enter;
        });

    const networkRectHeight = labelFontSize;

    networkGroup
        .attr("transform", (d) => `translate(${networkPositions[d.network].x},${networkPositions[d.network].y})`)
        .on("mousemove", (event, d) => {
            const mainGraphSvg = d3.select(`.svg_${mainContainerClass}`);
            if(mainGraphSvg.node()){
                mainGraphSvg.selectAll<SVGPathElement, VoronoiNode<TreeData>>(".voronoiPath")
                    .attr("fill", (v) =>  v.parent && v.parent.data.name === d.network ? COLORS.midgrey : "white")
            }
        })
        .on("mouseout", () => {
            const mainGraphSvg = d3.select(`.svg_${mainContainerClass}`);
            if(mainGraphSvg.node()) {
                mainGraphSvg.selectAll(".voronoiPath")
                    .attr("fill", "white");
            }
        })

    networkGroup.select(".networkRect")
        .attr("stroke-width", 0)
        .attr("fill","white")
        .attr("rx", 5)
        .attr("ry",5)
        .attr("width", (d) => measureWidth(d.network,labelFontSize) * 1.1)
        .attr("x",(d) => -(measureWidth(d.network,labelFontSize) * 1.1)/2)
        .attr("height", networkRectHeight)
        .attr("y",   -networkRectHeight/2 );

    networkGroup.select(".networkRectLabel")
         .attr("text-anchor","middle")
        .attr("fill", COLORS.black)
        .attr("font-size",labelFontSize)
        .style("dominant-baseline","middle")
        .attr("y",  2 )
        .text((d) => d.network);

    const linksGroup = svg.select(".linkGroup")
        .selectAll(".networkLinksGroup")
        .data(networkLinks)
        .join((group) => {
            const enter = group.append("g").attr("class", "networkLinksGroup");
            enter.append("path").attr("class", "linkLine");
            return enter;
        });

    linksGroup.select(".linkLine")
        .attr("marker-end",`url(#arrowEndDark${containerClass})`)
        .attr("stroke",COLORS.midgrey)
        .attr("stroke-width",0.75)
        .attr("d", (d) => {
            const sourcePosition = networkPositions[d.source as keyof typeof networkPositions];
            const targetPosition = networkPositions[d.target as keyof typeof networkPositions];
            const yTop = sourcePosition.y < targetPosition.y ? networkRectHeight/2 : -networkRectHeight/2;
            const yBottom = sourcePosition.y < targetPosition.y ? -networkRectHeight/2 : networkRectHeight/2;
            return  `M${sourcePosition.x},${sourcePosition.y + yTop}L${targetPosition.x},${targetPosition.y + yBottom}`;
        })





}
