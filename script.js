// 테트리스 보드 설정 (표준: 가로 10칸, 세로 20행)
const COLS = 10;
const ROWS = 20;
const DROP_INTERVAL = 800;

// 줄 삭제 수에 따른 점수 (1~4줄)
const LINE_SCORES = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

// DOM 요소
const boardElement = document.getElementById("game-board");
const scoreElement = document.getElementById("score");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const gameOverElement = document.getElementById("game-over");

// 테트로미노 블록 정의 (I, O, T, S, Z, J, L)
const PIECES = {
  I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
  O: { shape: [[1,1],[1,1]] },
  T: { shape: [[0,1,0],[1,1,1],[0,0,0]] },
  S: { shape: [[0,1,1],[1,1,0],[0,0,0]] },
  Z: { shape: [[1,1,0],[0,1,1],[0,0,0]] },
  J: { shape: [[1,0,0],[1,1,1],[0,0,0]] },
  L: { shape: [[0,0,1],[1,1,1],[0,0,0]] },
};

const PIECE_TYPES = Object.keys(PIECES);
const GAME_KEYS = new Set(["ArrowLeft","ArrowRight","ArrowDown","ArrowUp","Space"]);

let score = 0, isPlaying = false, isGameOver = false;
let board = [], currentPiece = null, cellElements = [], dropTimer = null;

function createEmptyBoard() { return Array.from({length:ROWS},()=>Array(COLS).fill(null)); }
function cloneShape(shape) { return shape.map((row)=>[...row]); }
function isOnBoard(boardRow, boardCol) { return boardCol>=0&&boardCol<COLS&&boardRow>=0&&boardRow<ROWS; }
function forEachBlockCell(piece,offsetX,offsetY,callback) {
  const {shape,x,y}=piece;
  for(let row=0;row<shape.length;row++) for(let col=0;col<shape[row].length;col++)
    if(shape[row][col]) callback(y+row+offsetY,x+col+offsetX);
}
function createPiece(type) {
  const pieceType=type||PIECE_TYPES[Math.floor(Math.random()*PIECE_TYPES.length)];
  const shape=cloneShape(PIECES[pieceType].shape);
  return {type:pieceType,shape,x:Math.floor((COLS-shape[0].length)/2),y:0};
}
function canMove(piece,dx,dy,matrix) {
  let canPlace=true;
  forEachBlockCell(piece,dx,dy,(boardRow,boardCol)=>{
    if(!canPlace)return;
    if(boardCol<0||boardCol>=COLS||boardRow>=ROWS){canPlace=false;return;}
    if(boardRow<0)return;
    if(matrix[boardRow][boardCol])canPlace=false;
  });
  return canPlace;
}
function lockPiece() {
  if(!currentPiece)return;
  const {type}=currentPiece;
  forEachBlockCell(currentPiece,0,0,(boardRow,boardCol)=>{
    if(isOnBoard(boardRow,boardCol)) board[boardRow][boardCol]=type;
  });
}
function clearLines() {
  let linesCleared=0;
  for(let row=ROWS-1;row>=0;row--) {
    if(!board[row].every((cell)=>cell!==null))continue;
    board.splice(row,1); board.unshift(Array(COLS).fill(null)); linesCleared++; row++;
  }
  return linesCleared;
}
function addScore(linesCleared) {
  if(linesCleared<=0)return;
  score+=LINE_SCORES[linesCleared]||linesCleared*100; updateScore();
}
function tryMovePiece(dx,dy) {
  if(!currentPiece||!canMove(currentPiece,dx,dy,board))return false;
  currentPiece.x+=dx; currentPiece.y+=dy; return true;
}
function rotateShape(shape) {
  const rows=shape.length,cols=shape[0].length;
  const rotated=Array.from({length:cols},()=>Array(rows).fill(0));
  for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) rotated[col][rows-1-row]=shape[row][col];
  return rotated;
}
function tryRotatePiece() {
  if(!currentPiece)return false;
  const previousShape=cloneShape(currentPiece.shape);
  currentPiece.shape=rotateShape(previousShape);
  if(!canMove(currentPiece,0,0,board)){currentPiece.shape=previousShape;return false;}
  return true;
}
function hardDrop() { if(!currentPiece)return; while(tryMovePiece(0,1)){} landPiece(); }
function landPiece() {
  if(!currentPiece)return;
  lockPiece(); addScore(clearLines()); currentPiece=createPiece();
  if(!canMove(currentPiece,0,0,board)){triggerGameOver();return;}
  renderBoard();
}
function tick() {
  if(!isPlaying||!currentPiece)return;
  if(tryMovePiece(0,1)){renderBoard();return;}
  landPiece();
}
function startGameLoop() { stopGameLoop(); dropTimer=setInterval(tick,DROP_INTERVAL); }
function stopGameLoop() { if(!dropTimer)return; clearInterval(dropTimer); dropTimer=null; }
function triggerGameOver() {
  isPlaying=false; isGameOver=true; currentPiece=null; stopGameLoop();
  updateButtons(); updateGameOverUI(); renderBoard();
}
function resetGame() {
  stopGameLoop(); isGameOver=false; score=0; board=createEmptyBoard();
  currentPiece=createPiece(); updateScore(); updateGameOverUI(); renderBoard();
  if(isPlaying) startGameLoop();
}
function buildBoardGrid() {
  boardElement.innerHTML=""; cellElements=[];
  for(let row=0;row<ROWS;row++) {
    const rowCells=[];
    for(let col=0;col<COLS;col++) {
      const cell=document.createElement("div");
      cell.className="cell"; cell.dataset.row=row; cell.dataset.col=col;
      boardElement.appendChild(cell); rowCells.push(cell);
    }
    cellElements.push(rowCells);
  }
}
function paintCell(boardRow,boardCol,type) {
  if(!isOnBoard(boardRow,boardCol))return;
  cellElements[boardRow][boardCol].classList.add("filled",`piece-${type}`);
}
function clearCellStyles() {
  for(let row=0;row<ROWS;row++) for(let col=0;col<COLS;col++) cellElements[row][col].className="cell";
}
function renderBoard() {
  clearCellStyles();
  for(let row=0;row<ROWS;row++) for(let col=0;col<COLS;col++) if(board[row][col]) paintCell(row,col,board[row][col]);
  drawPiece();
}
function drawPiece() {
  if(!currentPiece)return;
  const {type}=currentPiece;
  forEachBlockCell(currentPiece,0,0,(boardRow,boardCol)=>paintCell(boardRow,boardCol,type));
}
function updateScore() { scoreElement.textContent=score; }
function updateButtons() { startBtn.disabled=isPlaying; restartBtn.disabled=!isPlaying&&!isGameOver; }
function updateGameOverUI() { gameOverElement.hidden=!isGameOver; }
function handleStart() { isPlaying=true; isGameOver=false; resetGame(); updateButtons(); }
function handleRestart() { isPlaying=true; isGameOver=false; resetGame(); updateButtons(); }
function handleKeyDown(event) {
  if(!isPlaying||!currentPiece)return;
  if(!GAME_KEYS.has(event.code))return;
  event.preventDefault();
  let shouldRender=false;
  switch(event.code) {
    case "ArrowLeft": shouldRender=tryMovePiece(-1,0); break;
    case "ArrowRight": shouldRender=tryMovePiece(1,0); break;
    case "ArrowDown": shouldRender=tryMovePiece(0,1); break;
    case "ArrowUp": shouldRender=tryRotatePiece(); break;
    case "Space": hardDrop(); return;
  }
  if(shouldRender) renderBoard();
}
function init() {
  buildBoardGrid(); board=createEmptyBoard(); updateGameOverUI(); renderBoard(); updateButtons();
  startBtn.addEventListener("click",handleStart);
  restartBtn.addEventListener("click",handleRestart);
  document.addEventListener("keydown",handleKeyDown);
}
init();
