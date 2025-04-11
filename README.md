[![smithery badge](https://smithery.ai/badge/@aqaranewbiz/mysql-server)](https://smithery.ai/server/@aqaranewbiz/mysql-server)
# MySQL MCP Server (Node.js)

이 저장소는 MySQL 데이터베이스에 연결할 수 있는 Smithery AI MCP 서버를 포함하고 있습니다.
Node.js로 구현되어 있어 JSON 처리와 비동기 작업에 효율적입니다.

## 기능

- MySQL 데이터베이스 연결 및 쿼리 실행
- HTTP 및 WebSocket 프로토콜 모두 지원
- JSON-RPC 2.0 기반 통신 (WebSocket)
- RESTful API 제공 (HTTP)
- 환경 변수 기반 설정
- Docker 및 Smithery AI와 호환

## 로컬 개발 및 테스트

### 필수 요구 사항
- Node.js 18 이상
- MySQL 서버 (로컬 또는 원격)

### 설치 방법

1. **저장소 복제**:
   ```bash
   git clone <repository-url>
   cd MCP_Server
   ```

2. **의존성 설치**:
   ```bash
   npm install
   ```

3. **환경 변수 설정** (선택 사항):
   ```bash
   # Linux/macOS
   export MYSQL_HOST=localhost
   export MYSQL_PORT=3306
   export MYSQL_USER=your_username
   export MYSQL_PASSWORD=your_password
   export MYSQL_DATABASE=your_database
   
   # Windows (CMD)
   set MYSQL_HOST=localhost
   set MYSQL_PORT=3306
   set MYSQL_USER=your_username
   set MYSQL_PASSWORD=your_password
   set MYSQL_DATABASE=your_database
   ```

### 서버 실행

```bash
# 기본 HTTP 서버로 실행
node index.js

# 또는 WebSocket 서버로 실행
SERVER_TYPE=websocket node index.js
```

### Docker로 실행

```bash
# Docker 이미지 빌드
docker build -t mysql-mcp-server .

# Docker 컨테이너 실행
docker run -p 3003:3003 \
  -e MYSQL_HOST=host.docker.internal \
  -e MYSQL_PORT=3306 \
  -e MYSQL_USER=your_username \
  -e MYSQL_PASSWORD=your_password \
  mysql-mcp-server
```

## MCP 도구

### mysql_query

MySQL 데이터베이스에 SQL 쿼리를 실행합니다.

**매개변수**:
- `query`: 실행할 SQL 쿼리 (필수)
- `db_config`: 데이터베이스 연결 설정 (선택 사항)
  - `host`: 데이터베이스 호스트
  - `port`: 데이터베이스 포트
  - `user`: 데이터베이스 사용자
  - `password`: 데이터베이스 비밀번호
  - `database`: 데이터베이스 이름

## API 참조

### HTTP API

#### GET /status
서버의 상태 정보를 반환합니다.

**응답 예제**:
```json
{
  "status": "running",
  "type": "mysql",
  "tools": ["mysql_query"]
}
```

#### POST /execute
SQL 쿼리를 실행합니다.

**요청 본문**:
```json
{
  "tool": "mysql_query",
  "parameters": {
    "query": "SELECT * FROM users",
    "db_config": {
      "host": "localhost",
      "port": 3306,
      "user": "root",
      "password": "password",
      "database": "mydb"
    }
  }
}
```

**응답 예제** (성공):
```json
{
  "results": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    },
    {
      "id": 2,
      "name": "Jane Smith",
      "email": "jane@example.com"
    }
  ]
}
```

**응답 예제** (오류):
```json
{
  "error": "Database error: Access denied for user 'root'"
}
```

### WebSocket API (JSON-RPC 2.0)

WebSocket을 통해 JSON-RPC 2.0 프로토콜로 통신합니다. 

#### initialize
서버를 초기화하고 상태 정보를 반환합니다.

**요청**:
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {},
  "id": 1
}
```

**응답**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "name": "MySQL MCP Server",
    "version": "1.0.0",
    "status": "initialized",
    "mysql_connection": "success",
    "config": {
      "mysql_host": "localhost",
      "mysql_port": 3306
    }
  },
  "id": 1
}
```

#### tools/list
사용 가능한 도구 목록을 반환합니다.

**요청**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "params": {},
  "id": 2
}
```

**응답**:
```json
{
  "jsonrpc": "2.0",
  "result": [
    {
      "name": "mysql_query",
      "description": "Execute a SQL query on MySQL database",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "SQL query to execute"
          },
          "db_config": {
            "type": "object",
            "description": "Optional database configuration",
            "properties": {
              "host": { "type": "string", "description": "Database host" },
              "port": { "type": "integer", "description": "Database port" },
              "user": { "type": "string", "description": "Database user" },
              "password": { "type": "string", "description": "Database password" },
              "database": { "type": "string", "description": "Database name" }
            }
          }
        },
        "required": ["query"]
      }
    }
  ],
  "id": 2
}
```

#### tools/call
도구를 호출하여 작업을 수행합니다.

**요청**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "tool": "mysql_query",
    "params": {
      "query": "SELECT * FROM users"
    }
  },
  "id": 3
}
```

**응답**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "results": [
      {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com"
      }
    ]
  },
  "id": 3
}
```

## Smithery AI에 배포

이 서버는 Smithery AI에 배포할 수 있도록 설계되었습니다. 배포 과정은 다음과 같습니다:

1. **Smithery 계정 생성**: https://smithery.ai 에서 계정을 생성합니다.

2. **저장소 연결**: GitHub 또는 다른 지원되는 저장소 서비스에 이 코드를 푸시하고, Smithery 대시보드에서 해당 저장소를 연결합니다.

3. **서버 배포**: Smithery 대시보드에서 배포 과정을 따릅니다. Smithery는 `Dockerfile`과 `smithery.yaml` 파일을 사용하여 서버를 자동으로 구성하고 배포합니다.

4. **설정 구성**: 배포 후, Smithery 대시보드에서 MySQL 연결 설정을 구성합니다.

## 구성 파일

### smithery.yaml

```yaml
version: '1'
configSchema:
  type: "object"
  properties:
    mysql_host:
      type: "string"
      description: "MySQL server host"
      default: "localhost"
    mysql_port:
      type: "integer"
      description: "MySQL server port"
      default: 3306
    mysql_user:
      type: "string"
      description: "MySQL username"
    mysql_password:
      type: "string"
      description: "MySQL password"
      format: "password"
    mysql_database:
      type: "string"
      description: "Default MySQL database"
    server_type:
      type: "string"
      description: "Server type to run (websocket or http)"
      enum: ["websocket", "http"]
      default: "http"
  required: ["mysql_user", "mysql_password"]
startCommand:
  type: 'stdio'
  commandFunction: |
    function getCommand(config) {
      return {
        command: 'node',
        args: ['index.js'],
        env: {
          "MYSQL_HOST": config.mysql_host || "localhost",
          "MYSQL_PORT": String(config.mysql_port || 3306),
          "MYSQL_USER": config.mysql_user,
          "MYSQL_PASSWORD": config.mysql_password,
          "MYSQL_DATABASE": config.mysql_database || "",
          "SERVER_TYPE": config.server_type || "http"
        }
      };
    }
```

## License
This project is licensed under the MIT License.