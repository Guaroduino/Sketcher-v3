import { useState, useCallback } from 'react';
import type { Guide, RulerGuide, MirrorGuide, PerspectiveGuide, Point, OrthogonalGuide, PerspectiveGuideLine, GridGuide, WorkspaceTemplate, GridType } from '../types';

export function useGuides(canvasSize: { width: number, height: number }) {
    const [activeGuide, setActiveGuide] = useState<Guide>('none');
    const [isOrthogonalVisible, setIsOrthogonalVisible] = useState(false);
    const [rulerGuides, setRulerGuides] = useState<RulerGuide[]>([]);
    const [mirrorGuides, setMirrorGuides] = useState<MirrorGuide[]>([]);
    const [perspectiveGuide, setPerspectiveGuide] = useState<PerspectiveGuide | null>(null);
    const [orthogonalGuide, setOrthogonalGuide] = useState<OrthogonalGuide>({ angle: 0 });
    const [gridGuide, setGridGuide] = useState<GridGuide>({ type: 'cartesian', spacing: 10, majorLineFrequency: 10, isoAngle: 60, majorLineColor: 'rgba(239, 68, 68, 0.6)', minorLineColor: 'rgba(128, 128, 128, 0.3)' });
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
                const vp1_x = width * 0.1;
                const vp2_x = width * 0.9;
                setPerspectiveGuide({
                    lines: {
                        green: [
                            { id: 'g1', start: { x: 0, y: 0 }, end: { x: vp1_x, y: horizon } },
                            { id: 'g2', start: { x: 0, y: height }, end: { x: vp1_x, y: horizon } },
                        ],
                        red: [
                            { id: 'r1', start: { x: width, y: 0 }, end: { x: vp2_x, y: horizon } },
                            { id: 'r2', start: { x: width, y: height }, end: { x: vp2_x, y: horizon } },
                        ],
                        blue: [
                            { id: 'b1', start: { x: width * 0.3, y: 0 }, end: { x: width * 0.3, y: height } },
                            { id: 'b2', start: { x: width * 0.7, y: 0 }, end: { x: width * 0.7, y: height } },
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

    const handleSetGridMajorLineColor = useCallback((color: string) => {
        setGridGuide(g => ({ ...g, majorLineColor: color }));
    }, []);

    const handleSetGridMinorLineColor = useCallback((color: string) => {
        setGridGuide(g => ({ ...g, minorLineColor: color }));
    }, []);

    const loadGuideState = useCallback((guideState: any) => {
        setActiveGuide(guideState.activeGuide);
        setIsOrthogonalVisible(guideState.isOrthogonalVisible);
        setRulerGuides(guideState.rulerGuides);
        setMirrorGuides(guideState.mirrorGuides);
        setPerspectiveGuide(guideState.perspectiveGuide);
        setOrthogonalGuide(guideState.orthogonalGuide);

        if (guideState.gridGuide) { // New format
            setGridGuide({ ...guideState.gridGuide, majorLineColor: guideState.gridGuide.majorLineColor || 'rgba(128, 128, 128, 0.6)', minorLineColor: guideState.gridGuide.minorLineColor || 'rgba(128, 128, 128, 0.3)' });
        } else { // Old format for backward compatibility
            setGridGuide(g => ({ ...g, type: guideState.isGridVisible ? 'cartesian' : 'none', majorLineColor: g.majorLineColor || 'rgba(128, 128, 128, 0.6)', minorLineColor: g.minorLineColor || 'rgba(128, 128, 128, 0.3)' }));
        }

        setAreGuidesLocked(guideState.areGuidesLocked);
        setIsPerspectiveStrokeLockEnabled(guideState.isPerspectiveStrokeLockEnabled);
        setIsSnapToGridEnabled(guideState.isSnapToGridEnabled);
    }, []);

    const resetPerspective = useCallback(() => {
        const { width, height } = canvasSize;
        const horizon = height * 0.4;
        const vp1_x = width * 0.1;
        const vp2_x = width * 0.9;
        setPerspectiveGuide({
            lines: {
                green: [
                    { id: 'g1', start: { x: 0, y: 0 }, end: { x: vp1_x, y: horizon } },
                    { id: 'g2', start: { x: 0, y: height }, end: { x: vp1_x, y: horizon } },
                ],
                red: [
                    { id: 'r1', start: { x: width, y: 0 }, end: { x: vp2_x, y: horizon } },
                    { id: 'r2', start: { x: width, y: height }, end: { x: vp2_x, y: horizon } },
                ],
                blue: [
                    { id: 'b1', start: { x: width * 0.3, y: 0 }, end: { x: width * 0.3, y: height } },
                    { id: 'b2', start: { x: width * 0.7, y: 0 }, end: { x: width * 0.7, y: height } },
                ],
            },
            guidePoint: { x: width / 2, y: height * 0.8 },
            extraGuideLines: { green: [], red: [], blue: [] }
        });
    }, [canvasSize]);

    return {
        activeGuide,
        isOrthogonalVisible,
        rulerGuides, setRulerGuides,
        mirrorGuides, setMirrorGuides,
        perspectiveGuide, setPerspectiveGuide,
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
        onSetGridMajorLineColor: handleSetGridMajorLineColor,
        onSetGridMinorLineColor: handleSetGridMinorLineColor,
        loadGuideState,
        resetPerspective,
    };
}