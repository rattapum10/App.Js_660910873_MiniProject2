
$base = "http://127.0.0.1:3000/api"

$tests = @(
    @{ Name = "GET bookings"; Uri = "$base/bookings"; Method = "GET" },
    @{ Name = "POST booking"; Uri = "$base/bookings"; Method = "POST"; Body = "{}" },
    @{ Name = "DELETE booking"; Uri = "$base/bookings/SMARTTRANSIT-AUTH-CHECK"; Method = "DELETE" }
)

foreach ($test in $tests) {
    try {
        $params = @{
            Uri = $test.Uri
            Method = $test.Method
            UseBasicParsing = $true
            TimeoutSec = 8
        }

        if ($test.Method -eq "POST") {
            $params.ContentType = "application/json"
            $params.Body = $test.Body
        }

        $response = Invoke-WebRequest @params
        $status = [int]$response.StatusCode
    }
    catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $status = [int]$_.Exception.Response.StatusCode
        } else {
            $status = 0
        }
    }

    if ($status -in @(401, 403)) {
        Write-Host "[PASS] $($test.Name) -> HTTP $status" -ForegroundColor Green
    } elseif ($status -eq 0) {
        Write-Host "[FAIL] $($test.Name) -> เชื่อมต่อไม่ได้" -ForegroundColor Red
    } else {
        Write-Host "[FAIL] $($test.Name) -> HTTP $status" -ForegroundColor Red
    }
}
