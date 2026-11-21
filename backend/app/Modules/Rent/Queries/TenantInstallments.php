<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Leases\Data\TenantLeaseKeyData;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\RentNotice;
use App\Shared\Tenancy\AcrossOrganizations;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Échéances que le locataire peut lire : appelées (émises, partiellement ou entièrement payées). Une échéance à venir
 * n'est pas encore une créance, une échéance annulée a vu son appel de loyer contrepassé : ni l'une ni l'autre ne sortent.
 */
final readonly class TenantInstallments
{
    public function __construct(
        private TenantRentScope $portee,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * @return list<InstallmentStatus>
     */
    public static function visibleStatuses(): array
    {
        return [InstallmentStatus::Issued, InstallmentStatus::PartiallyPaid, InstallmentStatus::Paid];
    }

    /**
     * Tri par identifiant UUID v7 décroissant, comme la lecture de l'organisation.
     *
     * @param  list<TenantLeaseKeyData>  $cles
     * @return CursorPaginator<int, Installment>
     */
    public function page(array $cles, ?string $leaseId, ?InstallmentStatus $statut, ?string $curseur, int $parPage): CursorPaginator
    {
        return $this->visible($cles)
            ->when($leaseId !== null, fn (Builder $q) => $q->where('lease_id', (string) $leaseId))
            ->when($statut !== null, fn (Builder $q) => $q->where('status', $statut?->value))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     */
    public function get(array $cles, string $id): Installment
    {
        return (Str::isUuid($id) ? $this->visible($cles)->whereKey($id)->first() : null) ?? throw ErrorCode::InstallmentNotFound->problem('Cette échéance est introuvable.');
    }

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     */
    public function notice(array $cles, string $id): RentNotice
    {
        $echeance = $this->get($cles, $id);

        return $this->contexte->run($echeance->organization_id, fn (): ?RentNotice => RentNotice::query()->where('installment_id', $echeance->id)->first())
            ?? throw ErrorCode::NoticeNotFound->problem('Cet avis d\'échéance est introuvable.');
    }

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     * @return Builder<Installment>
     */
    private function visible(array $cles): Builder
    {
        $requete = $this->portee->restrict(AcrossOrganizations::query(Installment::class), $cles)
            ->whereIn('status', array_map(fn (InstallmentStatus $s): string => $s->value, self::visibleStatuses()));

        foreach ($cles as $cle) {
            if ($cle->exitedOn !== null) {
                $requete->whereNot(fn (Builder $apresSortie) => $apresSortie
                    ->where('organization_id', $cle->organizationId)
                    ->where('lease_id', $cle->leaseId)
                    ->where('due_date', '>=', $cle->exitedOn));
            }
        }

        return $requete;
    }
}
