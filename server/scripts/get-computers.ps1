$computers = Get-ADComputer -Filter * | Select-Object -ExpandProperty Name
$computers | ConvertTo-Json