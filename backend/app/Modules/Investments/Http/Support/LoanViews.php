<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Support;

use App\Modules\Investments\Http\Resources\LoanResource;
use App\Modules\Investments\Models\Loan;
use App\Modules\Investments\Queries\Loans;
use Carbon\CarbonImmutable;

final readonly class LoanViews
{
    public function __construct(private Loans $prets) {}

    public function one(Loan $pret, bool $detail = true): LoanResource
    {
        $jour = CarbonImmutable::today();

        return new LoanResource(
            $pret, $this->prets->outstanding([$pret], $jour)[$pret->id] ?? (int) $pret->principal->getAmount(), $jour, $detail,
            $detail ? $this->prets->fees($pret->id) : [], $detail ? $this->prets->attestations($pret->id) : [],
        );
    }

    /**
     * @param  list<Loan>  $prets
     * @return list<LoanResource>
     */
    public function many(array $prets): array
    {
        $jour = CarbonImmutable::today();
        $restants = $this->prets->outstanding($prets, $jour);

        return array_map(fn (Loan $p): LoanResource => new LoanResource($p, $restants[$p->id] ?? (int) $p->principal->getAmount(), $jour), $prets);
    }
}
