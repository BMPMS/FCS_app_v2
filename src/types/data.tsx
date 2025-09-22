import * as d3 from "d3";

export interface DataNode {
    node:string;
    type: string;
    class: string;
    desc: string;
    id?: string;
    nodeDepth?: number;
}

export interface DataLink {
    source: string ;
    target: string ;
    type: string;
}

export interface ChainNode extends d3.SimulationNodeDatum {
    id: string;
    type: string;
    class: string;
    desc: string;
    network: string;
    depth: number;
    fail?: boolean;

}
export interface ChainLink  extends d3.SimulationLinkDatum<ChainNode>{
    id: string;
    source: string | ChainNode;
    target: string | ChainNode;
    type: string;

}
export interface ChartNode extends d3.SimulationNodeDatum{
    id: string;
    node:string;
    type: string;
    class: string;
    desc: string;
    nodeDepth: number;
    xPos?: number;
    yPos?:number;
    finalDepth?: boolean
}

export type TreeData = {
    name: string;
    description: string;
    value: number;
    children?: TreeData[];
    data?:  ChartNode[];
    startPosition?: [number,number];
    network?: string;
}

export type PolygonWithSite = [number, number][] & { site: { x: number; y: number,originalObject?:{index: number} } };
export interface VoronoiNode<TreeData> extends d3.HierarchyNode<TreeData> {
    polygon: PolygonWithSite;
}
export interface CompleteVoronoiNode {
    depth: number,
    data: TreeData,
    polygon: PolygonWithSite,
    children?: boolean,
    parent?: TreeData
}
export interface NetworkNode extends d3.SimulationNodeDatum  {
    network: string;
    centreX: number;
    centreY: number;
    polygon: [number,number][];
    node: ChartNode;
    previousX?: number;
    previousY?: number;
    radius?: number;
}



export interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode>
{id: string;
    source: string | NetworkNode;
    target: string | NetworkNode;
    type: string;
}

export interface ChartLink {
    source: string ;
    target: string ;
    type: string;
    id: string;
}

export type ArcRoute = {
    source_net: string;
    source_node: string;
    dest_net: string;
    dest_node: string;
}

export type Network = {
    network: string;
    network_desc: string;
    nodes: ChartNode[];
    links: ChartLink[];
}


export type Layer = {
    layer: number;
    network: string;
}
export type Architecture = {
    arch_id: number;
    arch_name: string;
    arch_num_layers: number;
    layers:Layer[];
    routes: ArcRoute[];
}

export type ChartData = {
    architecture: Architecture[],
    networks: { id: string, data: Network}[];
}


