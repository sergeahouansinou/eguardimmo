<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support\Probes;

use App\Modules\Operations\Data\ProbeResult;
use App\Modules\Operations\Enums\ProbeState;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Gotenberg (génération de PDF) : `GET /health`. Une connexion refusée est `down` ; un délai dépassé ou une réponse inattendue sont `unknown`.
 */
final class PdfProbe implements Probe
{
    public function key(): string
    {
        return 'pdf';
    }

    public function run(): ProbeResult
    {
        $url = rtrim((string) config('operations.gotenberg_url'), '/');

        if ($url === '') {
            return new ProbeResult(ProbeState::Unknown, ['configured' => false, 'latency_ms' => null]);
        }

        $debut = hrtime(true);

        try {
            $reponse = Http::timeout((int) config('operations.health_probe_timeout_seconds'))->connectTimeout((int) config('operations.health_probe_timeout_seconds'))->get("{$url}/health");
        } catch (ConnectionException $erreur) {
            return new ProbeResult(str_contains($erreur->getMessage(), 'cURL error 28') || str_contains(mb_strtolower($erreur->getMessage()), 'timed out') ? ProbeState::Unknown : ProbeState::Down, ['configured' => true, 'latency_ms' => null]);
        }

        $ms = (int) round((hrtime(true) - $debut) / 1_000_000);
        $etat = match (true) {
            $reponse->successful() => ProbeState::Ok,
            $reponse->serverError() => ProbeState::Down,
            default => ProbeState::Unknown,
        };

        return new ProbeResult($etat, ['configured' => true, 'latency_ms' => $ms]);
    }
}
