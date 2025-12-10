const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec, execFile } = require('child_process');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-user, x-role');
  next();
});

const users = {
  'администратор': { password: '4ikiFricki4!', role: 'superadmin' },
  'pilipenko': { password: 'Qwerty2826!', role: 'admin' },
  'shamak': { password: 'Qwerty2826!', role: 'operator' },
  'betanov': { password: 'Qwerty2826!', role: 'operator' },
  'ischenko': { password: 'Qwerty2826!', role: 'operator' },
  'babarin': { password: 'Qwerty2826!', role: 'operator' },
  'bakerova': { password: 'Qwerty2826!', role: 'operator' },
  'koshenkov': { password: 'Qwerty2826!', role: 'operator' },
  'karelin': { password: 'Qwerty2826!', role: 'operator' },
  'danilov': { password: 'Qwerty2826!', role: 'operator' },
  'mojsejchenko': { password: 'Qwerty2826!', role: 'operator' },
  'korolko': { password: 'Qwerty2826!', role: 'operator' },
  'golenovich': { password: 'Qwerty2826!', role: 'operator' },
  'sylagaev': { password: 'Qwerty2826!', role: 'operator' },
  'user': { password: 'user', role: 'viewer' }
};

function authMiddleware(req, res, next) {
  const username = decodeURIComponent(req.headers['x-user'] || '');
  const role = decodeURIComponent(req.headers['x-role'] || '');

  if (!username || !role || !users[username] || users[username].role !== role) {
    return res.status(401).json({ error: 'Неавторизован' });
  }

  req.user = { username, role };
  next();
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  res.json({ username, role: user.role });
});

app.post('/run-script', authMiddleware, (req, res) => {
  const { hosts, action } = req.body;

  if (!Array.isArray(hosts) || hosts.length === 0) {
    return res.status(400).send('Не выбраны хосты');
  }

  //Логирование действий
  const now = new Date();
  const timestamp = now.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(',', '');
  const logLine = `[${timestamp}] пользователь: ${req.user.username} | роль: ${req.user.role} | действие: ${action} | хосты: ${hosts.join(', ')}\n`;
  const logFilePath = path.join(__dirname, 'logs', 'actions.log');
  const isFirstDay = now.getDate() === 1;
  const archiveName = `actions-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.log`;
  const archivePath = path.join(__dirname, 'logs', archiveName);

  if (isFirstDay && fs.existsSync(logFilePath) && !fs.existsSync(archivePath)) {
    fs.renameSync(logFilePath, archivePath);
  }
  fs.appendFile(logFilePath, logLine, err => { 
    if (err) console.error('Ошибка записи лога:', err); 
  });

  const results = [];
  let completed = 0;

  hosts.forEach(host => {
    const command = `powershell.exe -File ./scripts/${action}.ps1 -ComputerName ${host}`;
    exec(command, (error, stdout, stderr) => {
      results.push({
        host,
        output: error ? stderr : stdout
      });

      completed++;
      if (completed === hosts.length) {
        const formatted = results
          .map(r => `# ${r.host}\n${r.output}`)
          .join('\n\n');
        res.send(formatted);
      }
    });
  });
});

app.get('/api/computers', authMiddleware, (req, res) => {
  const scriptPath = path.join(__dirname, 'scripts', 'get-computers.ps1');

  execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath], (error, stdout, stderr) => {
    if (error) {
      console.error('Ошибка при выполнении PowerShell:', error);
      return res.status(500).json({ error: 'Ошибка при получении списка компьютеров' });
    }

    try {
      const computers = JSON.parse(stdout);
      res.json(computers);
    } catch (parseError) {
      console.error('Ошибка парсинга JSON:', parseError);
      res.status(500).json({ error: 'Ошибка обработки данных' });
    }
  });
});

//API для получения логов
app.get('/api/logs', authMiddleware, (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const logPath = path.join(__dirname, 'logs', 'actions.log');
  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка чтения логов' });
    }

    const lines = data.trim().split('\n');
    const parsed = lines.map(line => {
      const match = line.match(/^\[(.*?)\] пользователь: (.*?) \| роль: (.*?) \| действие: (.*?) \| хосты: (.*)$/);
      return match ? {
        time: match[1],
        user: match[2],
        role: match[3],
        action: match[4],
        hosts: match[5]
      } : null;
    }).filter(Boolean);

    res.json(parsed);
  });
});

const clientBuildPath = path.join(__dirname, '../client/build');
app.use(express.static(clientBuildPath));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

app.listen(3001, '0.0.0.0', () => {
  console.log('Server running on port 3001');
}); 
