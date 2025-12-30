
import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { Message } from '../types';
import { Icons } from './Icon';
import { useBrain } from '../contexts/BrainContext';

interface TreeViewPanelProps {
    onSelectNode: (nodeId: string) => void;
    onClose: () => void;
}

interface TreeNode {
    id: string;
    data: Message;
    children?: TreeNode[];
}

export const TreeViewPanel: React.FC<TreeViewPanelProps> = ({ onSelectNode, onClose }) => {
    const { messageMap, headId, currentThread } = useBrain();

    const svgRef = useRef<SVGSVGElement>(null);
    const gRef = useRef<SVGGElement>(null);
    const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity.translate(50, 250).scale(0.8));

    // 1. Build Hierarchy Data
    const hierarchyData = useMemo(() => {
        const messages = Object.values(messageMap) as Message[];

        const rootMsg = messages.find(m =>
            !m.parentId || (m.parentId && !messageMap[m.parentId])
        );
        
        if (!rootMsg) return null;

        const build = (msg: Message): TreeNode => {
            const children = msg.childrenIds
                .map(id => messageMap[id])
                .filter(Boolean)
                .map(build);

            return {
                id: msg.id,
                data: msg,
                children: children.length > 0 ? children : undefined
            };
        };

        return d3.hierarchy(build(rootMsg));

    }, [messageMap]);

    // 2. Compute Layout
    const layout = useMemo(() => {
        if (!hierarchyData) return { nodes: [], links: [] };
        const nodeWidth = 200;
        const nodeHeight = 80;
        const tree = d3.tree<TreeNode>()
            .nodeSize([nodeHeight, nodeWidth])
            .separation((a, b) => (a.parent === b.parent ? 1.2 : 2));
        const root = tree(hierarchyData);
        return { nodes: root.descendants(), links: root.links() };
    }, [hierarchyData]);

    // 3. Reference Links
    const referenceLinks = useMemo(() => {
        if (!layout.nodes.length) return [];
        const links: { source: any; target: any }[] = [];
        layout.nodes.forEach((node: any) => {
            const refId = node.data.data.referencedMessageId;
            if (refId) {
                const target = layout.nodes.find((n: any) => n.data.id === refId);
                if (target) links.push({ source: node, target });
            }
        });
        return links;
    }, [layout.nodes]);

    // 4. Zoom Behavior
    useEffect(() => {
        if (!svgRef.current || !gRef.current) return;
        const svg = d3.select(svgRef.current);
        const g = d3.select(gRef.current);
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 3])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
                setTransform(event.transform);
            });
        svg.call(zoom).call(zoom.transform, transform);
    }, []);

    const activePathIds = useMemo(() => new Set(currentThread.map(m => m.id)), [currentThread]);

    if (!hierarchyData) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex flex-col animate-fadeIn">
            {/* Header */}
            <div className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 shrink-0">
                <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Icons.GitBranch /> Conversation Tree
                    <span className="text-[10px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
                        {Object.keys(messageMap).length} Nodes
                    </span>
                </h2>
                <div className="flex items-center gap-4">
                    <div className="text-[10px] text-slate-500 hidden md:block">
                        Scroll to Zoom • Drag to Pan • Click to Jump
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <Icons.X />
                    </button>
                </div>
            </div>

            {/* SVG Canvas */}
            <div className="flex-1 overflow-hidden relative bg-slate-950">
                <svg ref={svgRef} className="w-full h-full cursor-move">
                    <g ref={gRef}>
                        {referenceLinks.map((link, i) => {
                            const source = { x: link.source.y, y: link.source.x };
                            const target = { x: link.target.y, y: link.target.x };
                            const pathData = d3.linkHorizontal().x((d: any) => d.x).y((d: any) => d.y)({ source, target } as any);
                            return <path key={`ref-link-${i}`} d={pathData || ''} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4,4" className="opacity-40" />;
                        })}

                        {layout.links.map((link, i) => {
                            const source = { x: link.source.y, y: link.source.x };
                            const target = { x: link.target.y, y: link.target.x };
                            const isActive = activePathIds.has(link.target.data.id);
                            const pathData = d3.linkHorizontal().x((d: any) => d.x).y((d: any) => d.y)({ source, target } as any);
                            return <path key={`link-${i}`} d={pathData || ''} fill="none" stroke={isActive ? '#3b82f6' : '#334155'} strokeWidth={isActive ? 2 : 1} strokeOpacity={isActive ? 0.8 : 0.4} className="transition-colors duration-300" />;
                        })}

                        {layout.nodes.map((node) => {
                            const isHead = node.data.id === headId;
                            const isActive = activePathIds.has(node.data.id);
                            const isUser = node.data.data.role === 'user';
                            const isTool = node.data.data.role === 'tool';
                            const isReferenced = referenceLinks.some(l => l.source === node || l.target === node);
                            const x = node.y;
                            const y = node.x;

                            return (
                                <g key={node.data.id} transform={`translate(${x},${y})`} onClick={(e) => { e.stopPropagation(); onSelectNode(node.data.id); }} className="cursor-pointer group">
                                    {isHead && <circle r="20" className="fill-blue-500/20 animate-pulse" />}
                                    <circle r={isHead ? 8 : 6} fill={isUser ? '#3b82f6' : (isTool ? '#a855f7' : '#10b981')} stroke={isActive ? '#fff' : (isReferenced ? '#fbbf24' : 'none')} strokeWidth={isReferenced ? 2 : (isActive ? 2 : 0)} className="transition-all duration-300" />
                                    <foreignObject x="12" y="-15" width="200" height="40" className="overflow-visible pointer-events-none">
                                        <div className={`text-[10px] px-2 py-1 rounded border shadow-lg backdrop-blur-md transition-all duration-300 ${isActive ? 'bg-slate-800/90 border-slate-600 text-slate-200' : 'bg-slate-900/80 border-slate-800 text-slate-500 opacity-60 group-hover:opacity-100 group-hover:scale-105'}`}>
                                            <div className="font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                                                {isUser ? 'User' : (isTool ? 'Tool' : 'Model')}
                                                {isHead && <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>}
                                                {node.data.data.referencedMessageId && <span className="text-amber-400" title="Has Reply Reference"><Icons.Reply /></span>}
                                            </div>
                                            <div className="truncate font-mono max-w-[180px]">
                                                {node.data.data.content?.slice(0, 30) || (node.data.data.toolCalls ? `Call: ${node.data.data.toolCalls[0].name}` : '...')}
                                            </div>
                                        </div>
                                    </foreignObject>
                                </g>
                            );
                        })}
                    </g>
                </svg>

                {/* Legend */}
                <div className="absolute bottom-6 left-6 flex flex-col gap-2 bg-slate-900/90 p-3 rounded-lg border border-slate-800 backdrop-blur pointer-events-none">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-full bg-blue-500"></span> User</div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-full bg-green-500"></span> Model</div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Tool</div>
                    <div className="w-full h-px bg-slate-800 my-1"></div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-full border-2 border-white bg-slate-800"></span> Active Path</div>
                    <div className="flex items-center gap-2 text-[10px] text-amber-400"><span className="w-4 h-0.5 border-t-2 border-dashed border-amber-400"></span> Reply Reference</div>
                </div>
            </div>
        </div>
    );
};
