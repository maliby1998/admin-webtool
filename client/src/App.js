import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  //Авторизация
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  //Основное состояние
  const [selectedHosts, setSelectedHosts] = useState([]);
  const [action, setAction] = useState('');
  const [output, setOutput] = useState('');
  const [computers, setComputers] = useState([]);
  const [showActions, setShowActions] = useState(false);

  //Восстановление авторизации из localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('username');
    const savedRole = localStorage.getItem('role');
    const savedLogin = localStorage.getItem('isLoggedIn');

    if (savedUser && savedRole && savedLogin === 'true') {
      setUsername(savedUser);
      setRole(savedRole);
      setIsLoggedIn(true);
    }
  }, []);

  //Список действий
  const actionsList = [
    { label: 'Обновить Firefox 122.0', value: 'update-firefox' },
    { label: 'Установить DHCP', value: 'install-dhcp' }
  ];

  //Логи
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logSearch, setLogSearch] = useState('');
  const [sortField, setSortField] = useState('time');
  const [sortAsc, setSortAsc] = useState(false);

  //Cостояние окна логов
  const [logWindowPos, setLogWindowPos] = useState({ x: 100, y: 100 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  //Загрузка хостов после входа
  useEffect(() => {
    if (isLoggedIn && username && role) {
      fetch('http://192.170.2.212:3001/api/computers', {
        headers: {
          'x-user': encodeURIComponent(username),
          'x-role': encodeURIComponent(role)
        }
      })
        .then(res => res.json())
        .then(data => setComputers(data))
        .catch(err => console.error('Ошибка загрузки хостов:', err));
    }
  }, [isLoggedIn, username, role]);

  //Вход
  const login = async () => {
    try {
      const res = await axios.post('http://192.170.2.212:3001/api/login', {
        username,
        password
      });
      setRole(res.data.role);
      setIsLoggedIn(true);
      //сохраняем в localStorage, что бы при обновлении не сбрасывалась авторизация
      localStorage.setItem('username', username);
      localStorage.setItem('role', res.data.role);
      localStorage.setItem('isLoggedIn', 'true');
    } catch (err) {
      alert('Неверный логин или пароль');
    }
  };

  //Выход
  const logout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setRole('');
    setSelectedHosts([]);
    setAction('');
    setOutput('');
    setLogs([]);
    localStorage.clear();
    //setShowLogs(false);
  };

  //Выбор хостов
  const toggleHost = (host) => {
    setSelectedHosts(prev =>
      prev.includes(host)
        ? prev.filter(h => h !== host)
        : [...prev, host]
    );
  };

  const toggleSelectAll = () => {
    if (selectedHosts.length === computers.length) {
      setSelectedHosts([]);
    } else {
      setSelectedHosts (computers);
    }
  };

  const isAllSelected = computers.length > 0 && selectedHosts.length === computers.length;

  //Запуск скрипта
  const runScript = async () => {
    try {
      const res = await axios.post('http://192.170.2.212:3001/run-script', {
        hosts: selectedHosts,
        action
      }, {
        headers: {
          'x-user': encodeURIComponent(username),
          'x-role': encodeURIComponent(role)
        }
      });
      setOutput(res.data);
    } catch (err) {
      setOutput(err.message);
    }
  };

  //загрузка логов
  const loadLogs = async () => {
    try {
      const res = await axios.get('http://192.170.2.212:3001/api/logs', {
        headers: {
          'x-user': encodeURIComponent(username),
          'x-role': encodeURIComponent(role)
        }
      });
      setLogs(res.data);
    } catch (err) {
      alert('Ошибка загрузки логов');
    }
  };

  //Функция начала перетаскивания окна
  const startDrag = (e) => {
    setDragging(true);
    setOffset({
      x: e.clientX - logWindowPos.x,
      y: e.clientY - logWindowPos.y
    });
  };

  //Обработка движения мыши
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragging) {
        setLogWindowPos({
          x: e.clientX - offset.x,
          y: e.clientY - offset.y
        });
      }
    };

    const handleMouseUp = () => setDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, offset]);

  //Переключение полноэкранного режима
  const toggleFullscreen = () => setFullscreen(prev => !prev);

  //Фильтрация и сортировка логов
  const filteredLogs = logs
    .filter(log =>
      log.user.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.time.toLowerCase().includes(logSearch.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField].toLowerCase();
      const bVal = b[sortField].toLowerCase();
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0
    });

  //Экран входа
  if (!isLoggedIn) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Spectra</h1>
        <h2>Вход в систему</h2>
        <input
          placeholder="Имя пользователя"
          value={username}
          onChange={e => setUsername(e.target.value)}
        /><br /><br />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={e => setPassword(e.target.value)}
        /><br /><br />
        <button onClick={login}>Войти</button>
      </div>
    );
  }

  //Основной интерфейс
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Spectra</h1>
      <h2>
        Добро пожаловать, {username} ({role}){' '}
        <button onClick={logout}>Выйти</button>  
      </h2>

      {/* Кнопка "Логи" только для супер админа */}
      {role === 'superadmin' && (
        <button onClick={() => {
          loadLogs();
          setShowLogs(true);
        }}>
          Логи
        </button>
      )}

      <label>Выберите хост:</label>
      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', padding: '0.5rem' }}>
        <div>
          <label>
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={toggleSelectAll}
            />
            <strong>Все хосты</strong>
          </label>
        </div>
        {computers.map((host, idx) => (
          <div key={idx}>
            <label>
              <input
                type="checkbox"
                value={host}
                checked={selectedHosts.includes(host)}
                onChange={() => toggleHost(host)}
              />
              {host}
            </label>
          </div>
        ))}
      </div>

      <br />

      <label>Выберите действие: </label>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button onClick={() => setShowActions(!showActions)}>
          Действия
        </button>
        {showActions && (
          <div style={{
            position: 'absolute',
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            padding: '0.5rem',
            zIndex: 10,
            width: '200px'
          }}>
            {actionsList.map((act, idx) => (
              <div key={idx} style={{ marginBottom: '0.5rem', cursor: 'pointer' }}
                   onClick={() => {
                    setAction(act.value);
                    setShowActions(false);
                   }}>
                {act.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <br /><br />
      <div><strong>Выбрано действие:</strong> {action || '-'}</div>

      <br />
      <button 
        onClick={runScript}
        disabled={selectedHosts.length === 0 || !action || role === 'viewer'}
      >
        Выполнить
      </button>

      <pre>{output}</pre>
      
      {/* Модальное окно логов */}
      {showLogs && !minimized && (
        <div style={{
          position: 'fixed',
          top: fullscreen ? 0 : logWindowPos.y,
          left: fullscreen ? 0 : logWindowPos.x,
          width: fullscreen ? '100%' : '80%',
          height: fullscreen ? '100%' : '80%',
          backgroundColor: 'white',
          border: '1px solid #ccc',
          boxShadow: '0 0 10px rgba(0,0,0,0.3)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          <div 
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#eee',
              padding: '0.5rem',
              cursor: 'move',
              userSelect: 'none'
            }}
            onMouseDown={startDrag}
          >
            <div style={{ fontWeight: 'bold' }}> logs </div>
            <div>
              <button style={{ marginRight: '0.5rem' }} onClick={() => setMinimized(true)}>—</button>
              <button style={{ marginRight: '0.5rem' }} onClick={toggleFullscreen}>↕</button>
              <button onClick={() => setShowLogs(false)}>X</button>
            </div>
          </div>
          <input
            placeholder="Поиск по имени, дате или действию"
            value={logSearch}
            onChange={e => setLogSearch(e.target.value)}
            style={{ width: '100%', marginBottom: '1rem' }}
          />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['time', 'user', 'action', 'hosts'].map(field => (
                  <th 
                    key={field}
                    style={{ border: '1px solid #ccc', padding: '0.5rem', cursor: 'pointer' }} 
                    onClick={() => {
                      setSortField(field);
                      setSortAsc(prev => field === sortField ? !prev : true);
                  }} 
                >  
                  {field.toUpperCase()} {sortField === field ? (sortAsc ? '^' : 'v') : ''}
                </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{log.time}</td>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{log.user}</td>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{log.action}</td>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{log.hosts}</td>
                </tr>
              ))}
            </tbody> 
          </table>
          <br />
        </div>
      )}
    {/*Панель логов внизу экрана */}
    {showLogs && minimized && (
      <div
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed',
          bottom: 0,
          left: '1rem',
          backgroundColor: '#eee',
          border: '1px solid #ccc',
          padding: '0.5rem 1rem',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          boxShadow: '0 -2px 5px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          zIndex: 1001
        }}
      >
        logs
      </div>
    )}
    </div>
  );
}

export default App;
