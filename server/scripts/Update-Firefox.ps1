# =============================
# Конфигурация
# =============================
$computers = @("BANANICH", "BANAN", "BANANOV", "ARKADIY")
$installerLocalPath = "C:\Firefox Setup 122.0.exe"
$remoteInstallerPath = "C:\Firefox Setup 122.0.exe"
$backupFolder = "C:\FirefoxBackup"
$logFile = "C:\FirefoxUpdateLog.txt"

# Очистка старого лога
If (Test-Path $logFile) { Remove-Item $logFile }

# =============================
# Основной цикл
# =============================
foreach ($computer in $computers) {
    $user = $computer.ToLower()
    $profileRoot = "C:\Users\$user\AppData\Roaming\Mozilla\Firefox\Profiles"
    $logEntry = "[${computer}]"

    try {
        # Проверка подключения
        $ping = Test-Connection -ComputerName $computer -Count 1 -Quiet
        if (-not $ping) {
            Add-Content $logFile "$logEntry - X Недоступен по сети"
            continue
        }

	$architecture = Invoke-Command -ComputerName $computer -ScriptBlock {
		(Get-WmiObject Win32_OperatingSystem).OSArchitecture
	}
	if (-not ($architecture.ToLower() -like "*64*")) {
		Add-Content $logFile "$logEntry - Пропущен (32-bit система)"
		continue
	}

	Copy-Item –Path $installerLocalPath –Destination "\\$computer\C$\" -Force

        # Проверка версии Firefox через реестр
        $version = Invoke-Command -ComputerName $computer -ScriptBlock {
            try {
                $key = "HKLM:\Software\Mozilla\Mozilla Firefox"
                (Get-ItemProperty -Path $key).CurrentVersion
            } catch {
                return $null
            }
        }

        if ($version) {
            $logEntry += " - Версия Firefox: $version"
        } else {
            $logEntry += " - Firefox не установлен"
        }

        # Обновлять, если версия < 122.0
        $needsUpdate = ($version -lt "122.0")

	$job = Start-Job -ScriptBlock {
		param($computer, $installerRemote, $profileRootRemote, $userRemote, $backupFolderRemote, $needsUpdate)
        
	Invoke-Command -ComputerName $computer -ScriptBlock {
            param($installerRemote, $profileRootRemote, $userRemote, $backupFolderRemote, $needsUpdate)
	    try {
            $ErrorActionPreference = "Stop"

            # 1. Проверка профиля
            $profilePath = Get-ChildItem -Path $profileRootRemote | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            $profileFull = Join-Path $profilePath.FullName ""

            # 2. Создание резервной копии
            New-Item -ItemType Directory -Path $backupFolderRemote -Force | Out-Null
            if (Test-Path "$profileFull\places.sqlite") {
	    Copy-Item "$profileFull\places.sqlite" -Destination $backupFolderRemote -Force
            }
	    if (Test-Path "$profileFull\logins.json") {
	    Copy-Item "$profileFull\logins.json" -Destination $backupFolderRemote -Force
	    }   
	    if (Test-Path "$profileFull\key4.db") {      
            Copy-Item "$profileFull\key4.db" -Destination $backupFolderRemote -Force
	    }

            # 3. Остановка Firefox
            Stop-Process -Name firefox -Force -ErrorAction SilentlyContinue

            # 4. Установка новой версии (если требуется)
            if ($needsUpdate) {
                Start-Process -FilePath $installerRemote -ArgumentList "/S"
                Start-Sleep -Seconds 30
            }

            # 5. Поиск нового профиля (после обновления)
            $newProfile = Get-ChildItem -Path $profileRootRemote | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            $newProfileFull = Join-Path $newProfile.FullName ""

            # 6. Восстановление данных
	    if (Test-Path "$backupFolderRemote\places.sqlite") {
            Copy-Item "$backupFolderRemote\places.sqlite" -Destination $newProfileFull -Force
            }
	    if (Test-Path "$backupFolderRemote\logins.json") {
            Copy-Item "$backupFolderRemote\logins.json" -Destination $newProfileFull -Force
	    }
            if (Test-Path "$backupFolderRemote\key4.db") {            
            Copy-Item "$backupFolderRemote\key4.db" -Destination $newProfileFull -Force
            }

            # 7. Очистка кэша и cookies
            Remove-Item "$newProfileFull\cookies.sqlite" -Force -ErrorAction SilentlyContinue
            Remove-Item "$newProfileFull\webappsstore.sqlite" -Force -ErrorAction SilentlyContinue
            Remove-Item "$newProfileFull\cache2" -Recurse -Force -ErrorAction SilentlyContinue
            Write-Output "ScriptBlock выполнен на $env:COMPUTERNAME"
	    } catch {
		Write-Output "[$env:COMPUTERNAME] - Ошибка внутри ScriptBlock: $_"
	    }
	    } -ArgumentList $installerRemote, $profileRootRemote, $userRemote, $backupFolderRemote, $needsUpdate
	    } -ArgumentList $computer, $remoteInstallerPath, $profileRoot, $user, $backupFolder, $needsUpdate
	

	if (Wait-Job -Job $job -Timeout 120) {
		Receive-Job $job | ForEach-Object { Add-Content $logFile "$logEntry - $_"}
	} else {
		Add-Content $logFile "$logEntry - Таймаут выполнения"
		Stop-Job $job
	}

        # Проверка версии после обновления
        $finalVersion = Invoke-Command -ComputerName $computer -ScriptBlock {
            try {
                $key = "HKLM:\Software\Mozilla\Mozilla Firefox"
                (Get-ItemProperty -Path $key).CurrentVersion
            } catch {
                return $null
            }
        }

        # Запись в лог
        if ($needsUpdate) {
            $logEntry += " -  Обновлён до $finalVersion"
        } else {
            $logEntry += " -  Пропущен (уже $finalVersion)"
        }

        $logEntry += " -  Кэш и cookies очищены"
        Add-Content $logFile $logEntry
    }
    catch {
        Add-Content $logFile "$logEntry -  Ошибка: $_"
    }
}