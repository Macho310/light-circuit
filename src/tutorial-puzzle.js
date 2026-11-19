// One small, valid 4×4 puzzle shared by every lesson.
export const tutorialPuzzle = {
  seed: 'tutorial', generatorVersion: 'tutorial-1',
  parts: [['wire'], ['wire'], ['resistor'], ['wire'], ['battery'], ['lamp'], ['lamp']],
  resistances: [[0], [0], [6], [0], [0], [6], [3]],
  shapes: Array.from({length: 7}, () => [[0, 0], [1, 0]]),
  links: Array.from({length: 7}, () => [[0, 1]]),
  wires: [[1,2],[2,3],[0,4],[4,8],[8,12],[3,7],[7,11],[11,15],[6,7],[13,14],[14,15]],
  fixed: [{a:0,b:1,type:'battery',r:0},{a:4,b:5,type:'lamp',r:6},{a:8,b:9,type:'lamp',r:3}],
  targetFractions: ['2', '4'],
};
export function tutorialPositions(lesson, step) {
  if (lesson === 0) return [step >= 3 ? {x:1,y:1,d:0} : null, null, null, null];
  const positions = [
    {x:1,y:1,d:0},
    lesson === 2 ? {x:1,y:2,d:0} : null,
    lesson === 2 && step >= 3 ? {x:0,y:3,d:0} : {x:1,y:1,d:1},
    {x:2,y:2,d:0},
  ];
  return positions;
}
