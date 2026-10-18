export const CHIP_BLOCKS = [
  { id: 'tensor', name: 'Tensor cores', color: '#f2731a', mm2: 60, tflops: 450, w: 90 },
  { id: 'sram', name: 'SRAM cache', color: '#4d8cf2', mm2: 40, tflops: 0, w: 15 },
  { id: 'hbm', name: 'HBM4 PHY', color: '#33bf8c', mm2: 30, tflops: 0, w: 25 },
  { id: 'cpu', name: 'Arm CPU cluster', color: '#d9cc40', mm2: 25, tflops: 8, w: 30 },
  { id: 'noc', name: 'Network-on-chip', color: '#b3b3b3', mm2: 15, tflops: 0, w: 8 },
  { id: 'io', name: 'NVLink / CPO I/O', color: '#b366e6', mm2: 20, tflops: 0, w: 20 },
];
export const DIE = { cols: 8, rows: 8, reticleMM2: 858 };
export const isEdge = i => { const x = i % DIE.cols, y = Math.floor(i / DIE.cols); return x === 0 || y === 0 || x === DIE.cols - 1 || y === DIE.rows - 1; };


