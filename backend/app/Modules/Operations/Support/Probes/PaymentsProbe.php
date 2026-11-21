<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support\Probes;

use App\Modules\Operations\Data\ProbeResult;
use App\Modules\Operations\Enums\ProbeState;

/**
 * Passerelle de paiement : seule la configuration se lit, sans appel au fournisseur ; l'état reste `unknown`.
 */
final class PaymentsProbe implements Probe
{
    public function key(): string
    {
        return 'payments';
    }

    public function run(): ProbeResult
    {
        $passerelle = (string) config('payments.gateway', 'none');
        $type = match ($passerelle) {
            'none' => 'none',
            'fake' => 'fake',
            default => 'provider',
        };

        return new ProbeResult(ProbeState::Unknown, ['gateway' => $type]);
    }
}
