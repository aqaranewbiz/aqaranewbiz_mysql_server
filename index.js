const { WebSocketServer } = require('ws');
const mysql = require('mysql2/promise');
const http = require('http');

// 환경 변수에서 MySQL 설정 가져오기
const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || '3306');
const MYSQL_USER = process.env.MYSQL_USER || '';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || '';

// 환경 변수 로그
console.error(`MySQL 설정: 호스트=${MYSQL_HOST}, 포트=${MYSQL_PORT}, 사용자=${MYSQL_USER}, DB=${MYSQL_DATABASE}`);
console.error('주의: 비밀번호는 보안상 로그에 표시하지 않습니다.!');

// 서버 포트 설정
const PORT = parseInt(process.env.PORT || '3003');

// MySQL 연결 함수
async function createConnection(database) {
  const dbConfig = {
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD
  };

  if (database) {
    dbConfig.database = database;
  } else if (MYSQL_DATABASE) {
    dbConfig.database = MYSQL_DATABASE;
  }

  try {
    return await mysql.createConnection(dbConfig);
  } catch (error) {
    console.error(`MySQL 연결 오류: ${error.message}`);
    throw error;
  }
}

// JSON-RPC 응답 생성
function createJsonRpcResponse(id, result) {
  return {
    jsonrpc: '2.0',
    result,
    id
  };
}

// JSON-RPC 오류 응답 생성
function createJsonRpcError(id, code, message) {
  return {
    jsonrpc: '2.0',
    error: { code, message },
    id
  };
}

// WebSocket 서버 생성 및 처리
function createWebSocketServer() {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.error('WebSocket 클라이언트 연결됨');

    ws.on('message', async (message) => {
      let request;
      try {
        request = JSON.parse(message);
        const { method, params, id } = request;

        // 메서드 처리
        if (method === 'initialize') {
          // 초기화 시 MySQL 연결 테스트
          let connectionStatus = 'success';
          let errorMessage = null;

          try {
            const connection = await createConnection();
            await connection.end();
          } catch (error) {
            connectionStatus = 'failed';
            errorMessage = error.message;
          }

          const response = createJsonRpcResponse(id, {
            name: 'MySQL MCP Server',
            version: '1.0.0',
            status: 'initialized',
            mysql_connection: connectionStatus,
            mysql_error: errorMessage,
            config: {
              mysql_host: MYSQL_HOST,
              mysql_port: MYSQL_PORT
            }
          });

          ws.send(JSON.stringify(response));
        } else if (method === 'tools/list') {
          // 도구 목록 반환
          const tools = [
            {
              name: 'mysql_query',
              description: 'Execute a SQL query on MySQL database',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'SQL query to execute'
                  },
                  db_config: {
                    type: 'object',
                    description: 'Optional database configuration',
                    properties: {
                      host: { type: 'string', description: 'Database host' },
                      port: { type: 'integer', description: 'Database port' },
                      user: { type: 'string', description: 'Database user' },
                      password: { type: 'string', description: 'Database password' },
                      database: { type: 'string', description: 'Database name' }
                    }
                  }
                },
                required: ['query']
              }
            }
          ];

          const response = createJsonRpcResponse(id, tools);
          ws.send(JSON.stringify(response));
        } else if (method === 'tools/call') {
          const { tool, params: toolParams } = params;

          if (tool === 'mysql_query') {
            const { query, db_config } = toolParams;

            if (!query) {
              const response = createJsonRpcError(id, -32602, 'Missing query parameter');
              ws.send(JSON.stringify(response));
              return;
            }

            try {
              // Use provided db_config if available, otherwise use environment variables
              let connection;
              if (db_config) {
                connection = await mysql.createConnection(db_config);
              } else {
                connection = await createConnection();
              }

              const [results] = await connection.query(query);
              await connection.end();

              // 결과 반환
              const response = createJsonRpcResponse(id, { results });
              ws.send(JSON.stringify(response));
            } catch (error) {
              const response = createJsonRpcError(id, -32000, `Database error: ${error.message}`);
              ws.send(JSON.stringify(response));
            }
          } else {
            const response = createJsonRpcError(id, -32601, `Unknown tool: ${tool}`);
            ws.send(JSON.stringify(response));
          }
        } else {
          const response = createJsonRpcError(id, -32601, `Method not found: ${method}`);
          ws.send(JSON.stringify(response));
        }
      } catch (error) {
        console.error(`메시지 처리 오류: ${error.message}`);
        const errorResponse = createJsonRpcError(
          request ? request.id : null, 
          -32603, 
          error.message
        );
        ws.send(JSON.stringify(errorResponse));
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket 오류: ${error.message}`);
    });

    ws.on('close', () => {
      console.error('WebSocket 클라이언트 연결 종료');
    });
  });

  server.listen(PORT, () => {
    console.error(`MySQL MCP WebSocket 서버가 포트 ${PORT}에서 실행 중`);
    console.error(`MySQL 설정: ${MYSQL_HOST}:${MYSQL_PORT}`);
  });

  return server;
}

// HTTP 서버 생성 및 처리
function createHttpServer() {
  const server = http.createServer(async (req, res) => {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // 상태 확인 엔드포인트
    if (req.method === 'GET' && req.url === '/status') {
      const status = {
        status: 'running',
        type: 'mysql',
        tools: ['mysql_query']
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
      return;
    }

    // 쿼리 실행 엔드포인트
    if (req.method === 'POST' && req.url === '/execute') {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const request = JSON.parse(body);
          const { tool, parameters } = request;
          
          if (tool !== 'mysql_query') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Unknown tool: ${tool}` }));
            return;
          }
          
          if (!parameters || !parameters.query) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing query parameter' }));
            return;
          }
          
          const { query, db_config } = parameters;
          
          try {
            // Use provided db_config if available, otherwise use environment variables
            let connection;
            if (db_config) {
              connection = await mysql.createConnection(db_config);
            } else {
              connection = await createConnection();
            }
            
            const [results] = await connection.query(query);
            await connection.end();
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ results }));
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        }
      });
      
      return;
    }
    
    // 없는 엔드포인트
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  
  server.listen(PORT, () => {
    console.error(`MySQL MCP HTTP 서버가 포트 ${PORT}에서 실행 중`);
    console.error(`MySQL 설정: ${MYSQL_HOST}:${MYSQL_PORT}`);
  });
  
  return server;
}

// 서버 타입에 따라 적절한 서버 시작
const SERVER_TYPE = process.env.SERVER_TYPE || 'http';

if (SERVER_TYPE === 'http') {
  createHttpServer();
} else {
  createWebSocketServer();
}

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
  console.error('서버를 종료합니다...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('서버를 종료합니다...');
  process.exit(0);
}); 