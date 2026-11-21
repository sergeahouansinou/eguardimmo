<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Enums\ScanVerdict;

/**
 * Faux analyseur des tests : la chaîne de test EICAR est infectée, et `documents.malware.fake_unavailable` simule un analyseur injoignable.
 */
final class FakeScanner implements MalwareScanner
{
    public const string EICAR = 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

    public function scan($flux): ScanVerdict
    {
        if (config('documents.malware.fake_unavailable') === true) {
            return ScanVerdict::Unverifiable;
        }

        $contenu = stream_get_contents($flux);

        return is_string($contenu) && str_contains($contenu, self::EICAR) ? ScanVerdict::Infected : ScanVerdict::Clean;
    }

    public function enabled(): bool
    {
        return true;
    }
}
