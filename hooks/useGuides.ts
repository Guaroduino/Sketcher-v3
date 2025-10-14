import { useState, useCallback } from 'react';
import type { Guide, RulerGuide, MirrorGuide, PerspectiveGuide, Point, OrthogonalGuide, PerspectiveGuideLine, GridGuide, WorkspaceTemplate, GridType } from '../types';

export function useGuides(canvasSize: { width: number, height: number }) {
    const [activeGuide, setActiveGuide] = useState<Guide>('none');
    const [isOrthogonalVisible, setIsOrthogonalVisible] = useState(false);
    const [rulerGuides, setRulerGuides] = useState<RulerGuide[]>([]);
    const [mirrorGuides, setMirrorGuides] = useState<MirrorGuide[]>([]);
    const [perspectiveGuide, setPerspectiveGuide] = useState<PerspectiveGuide | null>(null);
    const [perspectiveMatchState, setPerspectiveMatchState] = useState<{ enabled: boolean; points: Point[] } | null>(null);
    const [orthogonalGuide, setOrthogonalGuide] = useState<OrthogonalGuide>({ angle: 0 });
    const [gridGuide, setGridGuide] = useState<GridGuide>({ type: 'none', spacing: 50, majorLineFrequency: 5, isoAngle: 30 });
    const [areGuidesLocked, setAreGuidesLocked] = useState<boolean>(false);
    const [isPerspectiveStrokeLockEnabled, setIsPerspectiveStrokeLockEnabled] = useState(false);
    const [isSnapToGridEnabled, setIsSnapToGridEnabled] = useState(false);

    const handleSetActiveGuide = useCallback((guide: 'ruler' | 'perspective' | 'mirror') => {
        setActiveGuide(current => {
            const newGuide = current === guide ? 'none' : guide;

            if (newGuide === 'none' || newGuide !== 'perspective') {
                setIsPerspectiveStrokeLockEnabled(false);
            }
            if (newGuide === 'none') {
                setAreGuidesLocked(false);
            }

            if (newGuide === 'ruler' && rulerGuides.length === 0) {
                const { width, height } = canvasSize;
                setRulerGuides([{
                    id: `ruler-${Date.now()}`,
                    start: { x: width * 0.25, y: height / 2 },
                    end: { x: width * 0.75, y: height / 2 },
                }]);
            }
            if (newGuide === 'perspective' && !perspectiveGuide) {
                const { width, height } = canvasSize;
                const horizon = height * 0.4;
                setPerspectiveGuide({
                    lines: {
                        green: [
                            { id: 'g1', start: { x: -200, y: horizon - 150 }, end: { x: width * 0.25, y: horizon } },
                            { id: 'g2', start: { x: -200, y: height + 50 }, end: { x: width * 0.25, y: horizon } },
                        ],
                        red: [
                            { id: 'r1', start: { x: width + 200, y: horizon - 150 }, end: { x: width * 0.75, y: horizon } },
                            { id: 'r2', start: { x: width + 200, y: height + 50 }, end: { x: width * 0.75, y: horizon } },
                        ],
                        blue: [
                            { id: 'b1', start: { x: width * 0.4, y: -200 }, end: { x: width * 0.45, y: height } },
                            { id: 'b2', start: { x: width * 0.6, y: -200 }, end: { x: width * 0.55, y: height } },
                        ],
                    },
                    guidePoint: { x: width / 2, y: height * 0.8 },
                    extraGuideLines: { green: [], red: [], blue: [] }
                });
            }
            if (newGuide === 'mirror' && mirrorGuides.length === 0) {
                const { width, height } = canvasSize;
                setMirrorGuides([{
                    id: `mirror-${Date.now()}`,
                    start: { x: width / 2, y: 0 },
                    end: { x: width / 2, y: height }
                }]);
            }
            return newGuide;
        });
    }, [perspectiveGuide, mirrorGuides, rulerGuides, canvasSize]);

    const setGridType = useCallback((type: GridType) => {
      setGridGuide(g => ({ ...g, type }));
      if (type === 'none') {
        setIsSnapToGridEnabled(false);
      }
    }, []);

    const toggleSnapToGrid = useCallback(() => setIsSnapToGridEnabled(p => !p), []);
    const toggleOrthogonal = useCallback(() => setIsOrthogonalVisible(p => !p), []);

    const handleSetOrthogonalAngle = useCallback((angle: number) => {
        setOrthogonalGuide({ angle });
    }, []);

    const handleSetGridSpacing = useCallback((spacing: number) => {
        if (spacing > 0) {
            setGridGuide(g => ({ ...g, spacing }));
        }
    }, []);
    
    const handleSetGridIsoAngle = useCallback((angle: number) => {
        setGridGuide(g => ({ ...g, isoAngle: angle }));
    }, []);

    const handleSetGridMajorLineFrequency = useCallback((frequency: number) => {
        if (frequency > 0) {
            setGridGuide(g => ({ ...g, majorLineFrequency: frequency }));
        }
    }, []);

    const handleStartPerspectiveMatch = useCallback(() => {
        setPerspectiveGuide(null);
        setPerspectiveMatchState({ enabled: true, points: [] });
    }, []);

    const handleCancelPerspectiveMatch = useCallback(() => {
        setPerspectiveMatchState(null);
    }, []);

    const handleAddPerspectivePoint = useCallback((point: Point) => {
        if (!perspectiveMatchState || !perspectiveMatchState.enabled) return;

        const newPoints = [...perspectiveMatchState.points, point];

        if (newPoints.length === 12) {
            const newGuide: PerspectiveGuide = {
                lines: {
                    green: [
                        { id: 'g1', start: newPoints[0], end: newPoints[1] },
                        { id: 'g2', start: newPoints[2], end: newPoints[3] },
                    ],
                    red: [
                        { id: 'r1', start: newPoints[4], end: newPoints[5] },
                        { id: 'r2', start: newPoints[6], end: newPoints[7] },
                    ],
                    blue: [
                        { id: 'b1', start: newPoints[8], end: newPoints[9] },
                        { id: 'b2', start: newPoints[10], end: newPoints[11] },
                    ],
                },
                guidePoint: { x: canvasSize.width / 2, y: canvasSize.height * 0.8 },
                extraGuideLines: { green: [], red: [], blue: [] }
            };
            setPerspectiveGuide(newGuide);
            setPerspectiveMatchState(null);
        } else {
            setPerspectiveMatchState({ enabled: true, points: newPoints });
        }
    }, [perspectiveMatchState, canvasSize]);
    
    const loadGuideState = useCallback((guideState: any) => {
        setActiveGuide(guideState.activeGuide);
        setIsOrthogonalVisible(guideState.isOrthogonalVisible);
        setRulerGuides(guideState.rulerGuides);
        setMirrorGuides(guideState.mirrorGuides);
        setPerspectiveGuide(guideState.perspectiveGuide);
        setOrthogonalGuide(guideState.orthogonalGuide);
        
        if (guideState.gridGuide) { // New format
            setGridGuide(guideState.gridGuide);
        } else { // Old format for backward compatibility
            setGridGuide(g => ({ ...g, type: guideState.isGridVisible ? 'cartesian' : 'none' }));
        }

        setAreGuidesLocked(guideState.areGuidesLocked);
        setIsPerspectiveStrokeLockEnabled(guideState.isPerspectiveStrokeLockEnabled);
        setIsSnapToGridEnabled(guideState.isSnapToGridEnabled);
    }, []);

    return {
        activeGuide,
        isOrthogonalVisible,
        rulerGuides, setRulerGuides,
        mirrorGuides, setMirrorGuides,
        perspectiveGuide, setPerspectiveGuide,
        perspectiveMatchState,
        orthogonalGuide,
        gridGuide,
        areGuidesLocked, setAreGuidesLocked,
        isPerspectiveStrokeLockEnabled, setIsPerspectiveStrokeLockEnabled,
        isSnapToGridEnabled,
        toggleSnapToGrid,
        onSetActiveGuide: handleSetActiveGuide,
        setGridType,
        toggleOrthogonal,
        onSetOrthogonalAngle: handleSetOrthogonalAngle,
        onSetGridSpacing: handleSetGridSpacing,
        onSetGridMajorLineFrequency: handleSetGridMajorLineFrequency,
        onSetGridIsoAngle: handleSetGridIsoAngle,
        onStartPerspectiveMatch: handleStartPerspectiveMatch,
        onCancelPerspectiveMatch: handleCancelPerspectiveMatch,
        onAddPerspectivePoint: handleAddPerspectivePoint,
        loadGuideState,
    };
}