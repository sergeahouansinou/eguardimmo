<?php

declare(strict_types=1);

namespace App\Modules\Charges\Queries;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\StatementStatus;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\ChargeStatementLine;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Décomptes émis des lots du mandant, par la clé de `MandateDirectory::ownerScope()` (ADR 0032) : un décompte sans mandant, un brouillon ou la panne
 * d'un bail n'existe pas pour lui.
 */
final readonly class OwnerStatements
{
    /**
     * @return CursorPaginator<int, ChargeStatement>
     */
    public function page(OwnerScopeData $portee, ?string $curseur, int $parPage): CursorPaginator
    {
        return $this->visible($portee)->orderByDesc('id')->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function get(OwnerScopeData $portee, string $id): ChargeStatement
    {
        return (Str::isUuid($id) ? $this->visible($portee)->whereKey($id)->first() : null) ?? throw ErrorCode::StatementNotFound->problem();
    }

    /**
     * @param  Collection<int, ChargeStatement>  $decomptes
     * @return Collection<int, ChargeStatementLine>
     */
    public function lines(Collection $decomptes): Collection
    {
        return AcrossOrganizations::query(ChargeStatementLine::class)->whereIn('statement_id', $decomptes->pluck('id')->all())->orderBy('position')->get();
    }

    /**
     * @return Builder<ChargeStatement>
     */
    private function visible(OwnerScopeData $portee): Builder
    {
        $requete = $portee->restrictToMandants(AcrossOrganizations::query(ChargeStatement::class), 'organization_id', 'mandant_party_id');

        return $requete->whereIn('status', [StatementStatus::Issued->value, StatementStatus::Superseded->value]);
    }
}
