<?php

declare(strict_types=1);

namespace App\Modules\Leases\Jurisdictions;

use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Jurisdictions\Fr\CommonLawRegime;
use App\Modules\Leases\Jurisdictions\Fr\FurnishedResidentialRegime;
use App\Modules\Leases\Jurisdictions\Fr\MobilityLeaseRegime;
use App\Modules\Leases\Jurisdictions\Fr\UnfurnishedResidentialRegime;

final readonly class LeaseRegimes
{
    /** @var array<string, array<string, LeaseRegime>> */
    private array $index;

    public function __construct()
    {
        $regimes = [
            new UnfurnishedResidentialRegime,
            new FurnishedResidentialRegime,
            new MobilityLeaseRegime,
            new CommonLawRegime,
        ];

        $index = [];
        foreach ($regimes as $regime) {
            $index[$regime->jurisdiction()][$regime->key()] = $regime;
        }

        $this->index = $index;
    }

    /**
     * @return list<string>
     */
    public function jurisdictions(): array
    {
        return array_keys($this->index);
    }

    /**
     * @return list<LeaseRegime>
     */
    public function all(string $jurisdiction): array
    {
        return array_values($this->index[$jurisdiction] ?? throw ErrorCode::JurisdictionUnsupported->problem());
    }

    public function for(string $jurisdiction, string $key): LeaseRegime
    {
        return $this->index[$jurisdiction][$key] ?? throw ErrorCode::JurisdictionUnsupported->problem();
    }

    public function supports(string $jurisdiction, string $key): bool
    {
        return isset($this->index[$jurisdiction][$key]);
    }
}
