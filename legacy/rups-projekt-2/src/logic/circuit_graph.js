class CircuitGraph {
    constructor() {
        this.nodes = new Map();     // id -> node
        this.components = [];       // list of components
        this.MERGE_RADIUS = 85;     // global radius used for merging/pruning/traversal
        this.TRAVERSE_RADIUS = this.MERGE_RADIUS;
        // A closed loop should be detected even if only a single component bridges the battery terminals
        this.MIN_TRAVERSE_DEPTH = 1;
    }

    // ----------------------
    // Add node (merge by proximity)
    // ----------------------
    addNode(node) {
        if (!node) return null;
        if (!node.connected) node.connected = new Set();

        for (const existingNode of this.nodes.values()) {
            // avoid merging nodes that belong to same physical component endpoints of the same ID prefix
            if (node.id.substring(0, 8) === existingNode.id.substring(0, 8)) continue;

            const dx = existingNode.x - node.x;
            const dy = existingNode.y - node.y;
            const distance = Math.hypot(dx, dy);

            if (distance <= this.MERGE_RADIUS) {
                //console.log(` MERGE: ${node.id} -> ${existingNode.id} (dist=${distance.toFixed(1)})`);

                // merge adjacency sets
                if (node.connected) {
                    for (const n of node.connected) {
                        existingNode.connected.add(n);
                        //console.log(`   merged adjacency: ${existingNode.id} ↔ ${n.id}`);
                    }
                }

                // keep two-way refs so graph traversal using node.connected still works
                existingNode.connected.add(node);
                node.connected.add(existingNode);

                // update components pointing to old node to point to canonical node
                for (const comp of this.components) {
                    if (this.sameNode(comp.start, node)) comp.start = existingNode;
                    if (this.sameNode(comp.end, node)) comp.end = existingNode;
                }

                return existingNode;
            }
        }

        //console.log(` store new node: ${node.id}`);
        this.nodes.set(node.id, node);
        return node;
    }

    // ----------------------
    // Add component (wire, battery, resistor, etc.)
    // ----------------------
    addComponent(component) {
        if (!component) {
            console.warn("addComponent: invalid component");
            return;
        }

        if (!component.start || !component.end) {
            console.warn("addComponent: component missing endpoints", component.id);
            return;
        }

        //console.log(`addComponent(): ${component.id} (${component.type})`);

        // ensure nodes are canonical / merged
        component.start = this.addNode(component.start);
        component.end = this.addNode(component.end);

        // create adjacency
        component.start.connected.add(component.end);
        component.end.connected.add(component.start);

        this.components.push(component);
        //console.log(` component stored: ${component.id} start=${component.start.id} end=${component.end.id}`);
    }

    // ----------------------
    // Helpers: sameNode / isClose
    // ----------------------
    sameNode(a, b) {
        if (!a || !b) return false;
        return a === b || (a.x === b.x && a.y === b.y);
    }

    isClose(a, b, max = this.TRAVERSE_RADIUS) {
        if (!a || !b) return false;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.hypot(dx, dy) <= max;
    }

    // ----------------------
    // getConnections (logical: components attached to node)
    // ----------------------
    getConnections(node) {
        const out = [];
        for (const comp of this.components) {
            if (!comp) continue;
            if (this.sameNode(comp.start, node)) out.push({ component: comp, otherNode: comp.end });
            else if (this.sameNode(comp.end, node)) out.push({ component: comp, otherNode: comp.start });
        }
        //console.log(`getConnections(${node.id}) => [${out.map(o => o.component.id).join(", ")}]`);
        return out;
    }

    // ----------------------
    // getSpatialConnections: check each component endpoints against node (with radius)
    // ----------------------
    getSpatialConnections(node) {
        const results = [];
        for (const comp of this.components) {
            if (!comp) continue;
            if (!this.componentConducts(comp)) continue;

            // check proximity to comp.start
            if (comp.start && this.isClose(node, comp.start)) {
                results.push({ component: comp, otherNode: comp.end, matchedEndpoint: 'start' });
            }
            // check proximity to comp.end
            if (comp.end && this.isClose(node, comp.end)) {
                results.push({ component: comp, otherNode: comp.start, matchedEndpoint: 'end' });
            }
        }
        //console.log(`getSpatialConnections(${node.id}) -> ${results.length}`);
        return results;
    }

    componentConducts(comp) {
        if (!comp) return false;
        const conductiveTypes = ['wire', 'bulb', 'resistor', 'battery'];
        if (comp.type === 'switch') return !!comp.is_on;
        return conductiveTypes.includes(comp.type);
    }

    // ----------------------
    // findPathToBatteryEnd: proper traversal that respects endpoints even when nodes merged
    // ----------------------
    findPathToBatteryEnd(current, target, visitedComponents = new Set(), visitedNodes = new Set(), depth = 0) {
        if (!current) return false;

        // If we've actually arrived at target AFTER traversing enough components, success
        if (this.sameNode(current, target) && depth >= this.MIN_TRAVERSE_DEPTH) {
            //console.log(`✔ path success: reached battery end at depth=${depth}`);
            return true;
        }

        // Avoid infinite loops
        if (visitedNodes.has(current)) return false;
        visitedNodes.add(current);

        // Use spatial connections so we don't rely only on node.connected (which may be stale)
        const spatial = this.getSpatialConnections(current);

        for (const { component: comp, otherNode, matchedEndpoint } of spatial) {
            if (!comp) continue;

            if (visitedComponents.has(comp)) continue;
            visitedComponents.add(comp);

            // Skip non-conductive / switch-off
            if (!this.componentConducts(comp) || (comp.type === 'switch' && !comp.is_on)) {
                visitedComponents.delete(comp);
                continue;
            }

            // Determine the real next node: if otherNode equals current (due to merging), pick component's opposite endpoint
            let nextNode = otherNode;
            if (this.sameNode(nextNode, current)) {
                // pick the other endpoint explicitly
                nextNode = this.sameNode(comp.start, current) ? comp.end : comp.start;
            }

            // If still null or undefined – skip
            if (!nextNode) {
                visitedComponents.delete(comp);
                continue;
            }

            // Check actual physical distance between current and the matched endpoint (extra safeguard)
            // The matched endpoint is either comp.start or comp.end depending on proximity; use isClose to validate
            const endpoint = (matchedEndpoint === 'start') ? comp.start : comp.end;
            if (!this.isClose(current, endpoint)) {
                // if not actually close enough skip this traversal
                //console.log(` skipping comp ${comp.id} because matched endpoint isn't close (sanity)`);
                visitedComponents.delete(comp);
                continue;
            }

            //console.log(`→ traverse comp=${comp.id} (${comp.type}) current=${current.id} → next=${nextNode.id} depth=${depth+1}`);

            if (this.findPathToBatteryEnd(nextNode, target, visitedComponents, visitedNodes, depth + 1)) {
                return true;
            }

            visitedComponents.delete(comp);
        }

        return false;
    }

    // ----------------------
    // removeAllConnectionsFromComponent: called when component is moved/removed — prune stale refs
    // ----------------------
    removeAllConnectionsFromComponent(compLogic) {
        if (!compLogic) return;
        //console.log(`removeAllConnectionsFromComponent(${compLogic.id})`);

        const radius = this.MERGE_RADIUS;

        // 1) remove component from graph.components immediately (prevents double-handling)
        const idx = this.components.indexOf(compLogic);
        if (idx !== -1) {
            this.components.splice(idx, 1);
            //console.log(` removed component ${compLogic.id} from graph.components`);
        }

        // nodes that belonged to moved component
        const nodesToProcess = [compLogic.start, compLogic.end];

        // For each endpoint: prune its adjacency and remove stale inward references
        for (const movedNode of nodesToProcess) {
            if (!movedNode) continue;

            // ensure set present
            if (!movedNode.connected) movedNode.connected = new Set();

            //console.log(` checking movedNode ${movedNode.id}`);

            // snapshot neighbors because we'll modify during iteration
            const neighbors = [...movedNode.connected];

            for (const other of neighbors) {
                if (!other) {
                    movedNode.connected.delete(other);
                    continue;
                }

                // if same logical position, remove explicit self ref
                if (this.sameNode(movedNode, other)) {
                    if (movedNode === other) movedNode.connected.delete(other);
                    continue;
                }

                // compute distance and prune if out of range
                const dx = other.x - movedNode.x;
                const dy = other.y - movedNode.y;
                const distance = Math.hypot(dx, dy);

                if (distance > radius) {
                    movedNode.connected.delete(other);
                    other.connected?.delete(movedNode);
                    //console.log(` pruned ${movedNode.id} ↔ ${other.id} (dist=${distance.toFixed(1)} > ${radius})`);
                }
            }

            // remove stale references in global nodes map
            for (const node of this.nodes.values()) {
                if (!node || node === movedNode) continue;
                if (node.connected?.has(movedNode)) {
                    const dx = node.x - movedNode.x;
                    const dy = node.y - movedNode.y;
                    if (Math.hypot(dx, dy) > radius) {
                        node.connected.delete(movedNode);
                        movedNode.connected.delete(node);
                        //console.log(` removed stale ref ${node.id} -> ${movedNode.id}`);
                    }
                }
            }

            // If no other component references this movedNode and it has no connections, delete it
            const referenced = this.components.some(c => this.sameNode(c.start, movedNode) || this.sameNode(c.end, movedNode));
            const hasConnections = movedNode.connected && movedNode.connected.size > 0;
            if (!referenced && !hasConnections) {
                if (this.nodes.has(movedNode.id)) {
                    this.nodes.delete(movedNode.id);
                    //console.log(` deleted orphan node ${movedNode.id}`);
                }
            }
        }

        // 2) scan remaining components and null endpoints that are now inconsistent (out of radius)
        for (const comp of this.components) {
            if (!comp) continue;

            if (comp.start) {
                if ( (compLogic.start && this.sameNode(comp.start, compLogic.start)) ||
                     (compLogic.end && this.sameNode(comp.start, compLogic.end)) ) {
                    if (comp.end) {
                        const dx = comp.end.x - comp.start.x;
                        const dy = comp.end.y - comp.start.y;
                        if (Math.hypot(dx, dy) > radius) {
                            //console.log(` nulling comp ${comp.id}.start because it's too far from end`);
                            comp.start = null;
                        }
                    }
                }
            }

            if (comp.end) {
                if ( (compLogic.start && this.sameNode(comp.end, compLogic.start)) ||
                     (compLogic.end && this.sameNode(comp.end, compLogic.end)) ) {
                    if (comp.start) {
                        const dx = comp.start.x - comp.end.x;
                        const dy = comp.start.y - comp.end.y;
                        if (Math.hypot(dx, dy) > radius) {
                            //console.log(` nulling comp ${comp.id}.end because it's too far from start`);
                            comp.end = null;
                        }
                    }
                }
            }
        }
    }

    // ----------------------
    // simulate: logging + call findPathToBatteryEnd
    // ----------------------
    simulate() {
        //console.log("\nSIMULATE()");
        //console.log("Nodes:");
        for (const n of this.nodes.values()) {
        }
        //console.log("Components:");
        for (const c of this.components) {
        }

        const battery = this.components.find(c => c.type === 'battery');
        if (!battery) {
            console.warn("simulate: no battery found");
            return -1;
        }

        const start = battery.start;
        const end = battery.end;


        // run full traversal
        const closed = this.findPathToBatteryEnd(start, end);

        if (closed) {
            this.components.filter(c => c.type === 'bulb').forEach(b => b.turnOn?.());
            return 1;
        } else {
            this.components.filter(c => c.type === 'bulb').forEach(b => b.turnOff?.());
            return 0;
        }
    }
}

export { CircuitGraph };
