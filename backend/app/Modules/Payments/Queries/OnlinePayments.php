<?php

declare(strict_types=1);

namespace App\Modules\Payments\Queries;

use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Payments\Enums\ErrorCode;
use App\Modules\Payments\Enums\OnlinePaymentStatus;
use App\Modules\Payments\Models\OnlinePayment;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Lectures hors contexte d'organisation (webhook, rapprochement) et lectures de l'espace locataire, par la clé de l'ADR 0024 ;
 * `page()` et `get()` servent l'équipe, dans le contexte de la route.
 */
final readonly class OnlinePayments
{
    public function __construct(private LeaseDirectory $baux) {}

    public function byReference(string $provider, string $reference): ?OnlinePayment
    {
        return AcrossOrganizations::query(OnlinePayment::class)->where('provider', $provider)->where('provider_reference', $reference)->first();
    }

    /**
     * Page par identifiant croissant (UUID v7, donc par ancienneté) : l'appelant enchaîne les pages avec le dernier identifiant lu.
     *
     * @return list<OnlinePayment>
     */
    public function liveBefore(CarbonImmutable $avant, ?string $apresId, int $limite): array
    {
        return array_values(AcrossOrganizations::query(OnlinePayment::class)
            ->whereIn('status', [OnlinePaymentStatus::Pending->value, OnlinePaymentStatus::Processing->value])
            ->where('created_at', '<', $avant)
            ->whereNotNull('provider_reference')
            ->when($apresId !== null, fn ($q) => $q->where('id', '>', (string) $apresId))
            ->orderBy('id')
            ->limit($limite)
            ->get()
            ->all());
    }

    /**
     * @return list<OnlinePayment>
     */
    public function succeededSince(CarbonImmutable $depuis): array
    {
        return array_values(AcrossOrganizations::query(OnlinePayment::class)
            ->where('status', OnlinePaymentStatus::Succeeded->value)
            ->where('confirmed_at', '>=', $depuis)
            ->orderBy('confirmed_at')
            ->limit(500)
            ->get()
            ->all());
    }

    /**
     * @return array{payment: OnlinePayment, position: TenantStandingData}|null
     */
    public function findForTenant(string $userId, string $id, CarbonImmutable $today): ?array
    {
        $paiement = Str::isUuid($id) ? AcrossOrganizations::query(OnlinePayment::class)->whereKey($id)->first() : null;
        $position = $paiement === null ? null : $this->baux->tenantStanding($userId, $paiement->lease_id, $today);

        return $paiement === null || $position === null || $position->organizationId !== $paiement->organization_id || $position->partyId !== $paiement->party_id
            ? null
            : ['payment' => $paiement, 'position' => $position];
    }

    /**
     * @return CursorPaginator<int, OnlinePayment>
     */
    public function page(?OnlinePaymentStatus $statut, ?string $leaseId, int $parPage, ?string $curseur): CursorPaginator
    {
        return OnlinePayment::query()
            ->when($statut !== null, fn ($q) => $q->where('status', $statut?->value))
            ->when($leaseId !== null, fn ($q) => $q->where('lease_id', $leaseId))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function get(string $id): OnlinePayment
    {
        return (Str::isUuid($id) ? OnlinePayment::query()->find($id) : null) ?? throw ErrorCode::OnlinePaymentNotFound->problem();
    }
}
