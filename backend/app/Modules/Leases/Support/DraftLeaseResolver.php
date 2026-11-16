<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Jurisdictions\JurisdictionDataValidator;
use App\Modules\Leases\Jurisdictions\LeaseRegimes;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

final readonly class DraftLeaseResolver
{
    public function __construct(
        private LeaseRegimes $regimes,
        private JurisdictionDataValidator $donneesDeJuridiction,
    ) {}

    /**
     * @param  array<string, mixed>  $jurisdictionData
     *
     * @throws ValidationException
     */
    public function resolve(string $jurisdiction, string $regimeKey, array $jurisdictionData, string $startsOn, ?int $durationMonths, ?bool $tacitRenewal): DraftLeaseSettings
    {
        $regime = $this->regimes->for($jurisdiction, $regimeKey);
        $donnees = $this->donneesDeJuridiction->validate($regime, $jurisdictionData);

        $duree = $durationMonths ?? $regime->defaultDurationMonths($donnees);
        $minimum = $regime->minimumDurationMonths($donnees);
        $maximum = $regime->maximumDurationMonths($donnees);

        if ($duree < $minimum || ($maximum !== null && $duree > $maximum)) {
            throw ValidationException::withMessages([
                'duration_months' => [$maximum === null
                    ? "La durée doit être d'au moins {$minimum} mois pour ce régime."
                    : "La durée doit être comprise entre {$minimum} et {$maximum} mois pour ce régime."],
            ]);
        }

        $debut = CarbonImmutable::createFromFormat('!Y-m-d', $startsOn) ?: throw ErrorCode::LeasePeriodInvalid->problem();

        return new DraftLeaseSettings(
            $regime,
            $donnees,
            $duree,
            $tacitRenewal ?? $regime->tacitRenewal($donnees),
            $debut->addMonthsNoOverflow($duree)->toDateString(),
        );
    }
}
