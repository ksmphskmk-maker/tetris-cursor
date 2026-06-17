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
const touchButtons = document.querySelectorAll(".touch-btn");

// 테트로미노 블록 정의 (I, O, T, S, Z, J, L)
const PIECES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
};

const PIECE_TYPES = Object.keys(PIECES);

const GAME_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "ArrowUp",
  "Space",
]);

// 게임 상태
let score = 0;
let isPlaying = false;
let isGameOver = false;
let board = [];
let currentPiece = null;
let cellElements = [];
let dropTimer = null;

// --- 보드 데이터 ---

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneShape(shape) {
  return shape.map((row) => [...row]);
}

function isOnBoard(boardRow, boardCol) {
  return boardCol >= 0 && boardCol < COLS && boardRow >= 0 && boardRow < ROWS;
}

// 블록 shape의 각 칸에 대해 보드 좌표로 콜백 실행
function forEachBlockCell(piece, offsetX, offsetY, callback) {
  const { shape, x, y } = piece;

  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;

      callback(y + row + offsetY, x + col + offsetX);
    }
  }
}

// --- 블록 생성 ---

function createPiece(type) {
  const pieceType = type || PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  const shape = cloneShape(PIECES[pieceType].shape);
  const spawnX = Math.floor((COLS - shape[0].length) / 2);

  return {
    type: pieceType,
    shape,
    x: spawnX,
    y: 0,
  };
}

// --- 충돌 판정 ---

function canMove(piece, dx, dy, matrix) {
  let canPlace = true;

  forEachBlockCell(piece, dx, dy, (boardRow, boardCol) => {
    if (!canPlace) return;

    if (boardCol < 0 || boardCol >= COLS || boardRow >= ROWS) {
      canPlace = false;
      return;
    }

    // 스폰 직후처럼 보드 위쪽(row < 0)은 빈 공간으로 취급
    if (boardRow < 0) return;

    if (matrix[boardRow][boardCol]) {
      canPlace = false;
    }
  });

  return canPlace;
}

// --- 블록 고정 · 줄 삭제 · 점수 ---

function lockPiece() {
  if (!currentPiece) return;

  const { type } = currentPiece;

  forEachBlockCell(currentPiece, 0, 0, (boardRow, boardCol) => {
    if (!isOnBoard(boardRow, boardCol)) return;

    board[boardRow][boardCol] = type;
  });
}

function clearLines() {
  let linesCleared = 0;

  for (let row = ROWS - 1; row >= 0; row--) {
    const isFull = board[row].every((cell) => cell !== null);
    if (!isFull) continue;

    board.splice(row, 1);
    board.unshift(Array(COLS).fill(null));
    linesCleared++;
    row++;
  }

  return linesCleared;
}

function addScore(linesCleared) {
  if (linesCleared <= 0) return;

  score += LINE_SCORES[linesCleared] || linesCleared * 100;
  updateScore();
}

// --- 블록 이동 · 회전 · 낙하 ---

function tryMovePiece(dx, dy) {
  if (!currentPiece || !canMove(currentPiece, dx, dy, board)) {
    return false;
  }

  currentPiece.x += dx;
  currentPiece.y += dy;
  return true;
}

function rotateShape(shape) {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      rotated[col][rows - 1 - row] = shape[row][col];
    }
  }

  return rotated;
}

function tryRotatePiece() {
  if (!currentPiece) return false;

  const previousShape = cloneShape(currentPiece.shape);
  currentPiece.shape = rotateShape(previousShape);

  if (!canMove(currentPiece, 0, 0, board)) {
    currentPiece.shape = previousShape;
    return false;
  }

  return true;
}

function hardDrop() {
  if (!currentPiece) return;

  while (tryMovePiece(0, 1)) {}

  landPiece();
}

function landPiece() {
  if (!currentPiece) return;

  lockPiece();

  const linesCleared = clearLines();
  addScore(linesCleared);

  currentPiece = createPiece();

  if (!canMove(currentPiece, 0, 0, board)) {
    triggerGameOver();
    return;
  }

  renderBoard();
}

function tick() {
  if (!isPlaying || !currentPiece) return;

  if (tryMovePiece(0, 1)) {
    renderBoard();
    return;
  }

  landPiece();
}

// --- 게임 루프 · 상태 ---

function startGameLoop() {
  stopGameLoop();
  dropTimer = setInterval(tick, DROP_INTERVAL);
}

function stopGameLoop() {
  if (!dropTimer) return;

  clearInterval(dropTimer);
  dropTimer = null;
}

function triggerGameOver() {
  isPlaying = false;
  isGameOver = true;
  currentPiece = null;
  stopGameLoop();
  updateButtons();
  updateGameOverUI();
  renderBoard();
}

function resetGame() {
  stopGameLoop();
  isGameOver = false;
  score = 0;
  board = createEmptyBoard();
  currentPiece = createPiece();
  updateScore();
  updateGameOverUI();
  renderBoard();

  if (isPlaying) {
    startGameLoop();
  }
}

// --- 렌더링 ---

function buildBoardGrid() {
  boardElement.innerHTML = "";
  cellElements = [];

  for (let row = 0; row < ROWS; row++) {
    const rowCells = [];

    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = row;
      cell.dataset.col = col;
      boardElement.appendChild(cell);
      rowCells.push(cell);
    }

    cellElements.push(rowCells);
  }
}

function paintCell(boardRow, boardCol, type) {
  if (!isOnBoard(boardRow, boardCol)) return;

  const cell = cellElements[boardRow][boardCol];
  cell.classList.add("filled", `piece-${type}`);
}

function clearCellStyles() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      cellElements[row][col].className = "cell";
    }
  }
}

function renderBoard() {
  clearCellStyles();

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const type = board[row][col];
      if (type) paintCell(row, col, type);
    }
  }

  drawPiece();
}

function drawPiece() {
  if (!currentPiece) return;

  const { type } = currentPiece;

  forEachBlockCell(currentPiece, 0, 0, (boardRow, boardCol) => {
    paintCell(boardRow, boardCol, type);
  });
}

// --- UI ---

function updateScore() {
  scoreElement.textContent = score;
}

function updateButtons() {
  startBtn.disabled = isPlaying;
  restartBtn.disabled = !isPlaying && !isGameOver;
  updateTouchControls();
}

function updateTouchControls() {
  const enabled = isPlaying && !!currentPiece;

  touchButtons.forEach((button) => {
    button.disabled = !enabled;
  });
}

function updateGameOverUI() {
  gameOverElement.hidden = !isGameOver;
}

// 게임 조작 (키보드·터치 공통)
function performAction(action) {
  if (!isPlaying || !currentPiece) return;

  let shouldRender = false;

  switch (action) {
    case "left":
      shouldRender = tryMovePiece(-1, 0);
      break;
    case "right":
      shouldRender = tryMovePiece(1, 0);
      break;
    case "down":
      shouldRender = tryMovePiece(0, 1);
      break;
    case "rotate":
      shouldRender = tryRotatePiece();
      break;
    case "drop":
      hardDrop();
      return;
  }

  if (shouldRender) {
    renderBoard();
  }
}

// --- 이벤트 ---

function handleStart() {
  isPlaying = true;
  isGameOver = false;
  resetGame();
  updateButtons();
}

function handleRestart() {
  isPlaying = true;
  isGameOver = false;
  resetGame();
  updateButtons();
}

function handleKeyDown(event) {
  if (!isPlaying || !currentPiece) return;
  if (!GAME_KEYS.has(event.code)) return;

  event.preventDefault();

  const keyActionMap = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowDown: "down",
    ArrowUp: "rotate",
    Space: "drop",
  };

  performAction(keyActionMap[event.code]);
}

function handleTouchControl(event) {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;

  event.preventDefault();
  performAction(button.dataset.action);
}

function init() {
  buildBoardGrid();
  board = createEmptyBoard();
  updateGameOverUI();
  renderBoard();
  updateButtons();
  startBtn.addEventListener("click", handleStart);
  restartBtn.addEventListener("click", handleRestart);
  document.addEventListener("keydown", handleKeyDown);

  const touchControls = document.querySelector(".touch-controls");
  touchControls.addEventListener("pointerdown", handleTouchControl);
}

init();
