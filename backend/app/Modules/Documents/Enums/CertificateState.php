<?php

declare(strict_types=1);

namespace App\Modules\Documents\Enums;

use Carbon\CarbonInterface;

enum CertificateState: string
{
    case Valid = 'valid';
    case ToRenew = 'to_renew';
    case Expired = 'expired';

    /**
     * L'échéance est valable jusqu'à la fin du jour indiqué ; le rappel s'ouvre `$reminderDays` jours avant.
     */
    public static function at(CarbonInterface $today, ?CarbonInterface $expiresOn, int $reminderDays): self
    {
        if ($expiresOn === null) {
            return self::Valid;
        }

        $aujourdhui = $today->toDateString();
        $echeance = $expiresOn->toDateString();

        if ($aujourdhui > $echeance) {
            return self::Expired;
        }

        return $aujourdhui >= $expiresOn->copy()->subDays($reminderDays)->toDateString() ? self::ToRenew : self::Valid;
    }
}
