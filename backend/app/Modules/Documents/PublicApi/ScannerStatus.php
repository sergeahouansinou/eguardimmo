<?php

declare(strict_types=1);

namespace App\Modules\Documents\PublicApi;

use App\Modules\Documents\Data\ScannerHealthData;
use App\Modules\Documents\Support\ClamdPing;

/**
 * État de l'analyseur antivirus pour la santé de la plateforme (console) : lecture seule, une seconde au plus de délai par sonde.
 */
final readonly class ScannerStatus
{
    public function probe(int $delaiSecondes = 2): ScannerHealthData
    {
        $pilote = (string) config('documents.malware.scanner', 'none');

        if ($pilote !== 'clamd') {
            return new ScannerHealthData($pilote === 'fake', $pilote, 'unknown', null);
        }

        $debut = hrtime(true);
        $etat = ClamdPing::state((string) config('documents.malware.clamd_socket'), $delaiSecondes);

        return new ScannerHealthData(true, $pilote, $etat, (int) round((hrtime(true) - $debut) / 1_000_000));
    }
}
